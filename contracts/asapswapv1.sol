pragma solidity 0.6.2;
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Strings.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Pausable.sol";

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import "./IWETH.sol";

/// Swap Contract for ASAP Sniper Bot. 
/// Version : 1
/// It supports the swap only for UniswapV2.
contract AsapSwapV1 is Initializable, OwnableUpgradeSafe, PausableUpgradeSafe {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using Address for address;
    enum Status {SUCCESS,FAILED}

    enum SwapType {ETH_TO_ERC20,ERC20_TO_ETH,ERC20_TO_ERC20}

    struct Swap {
        uint256 fromTokenAmount;
        uint256 toTokenAmount;
        address payable trader;
        address token;
        SwapType swapType;
        Status status;
        bytes8 referralCode;
    }
   
   /// wrapped native token address for swap, it could be different for each network.
   /// Admin can adjust this variable using setWethAddress() method
    address private _wethContractAddress;

    // Admin user, Contract owner give some special right for Admin User.
    /// Only Contract owner can set Admin user. using setAdminUser() method
    address private _admin;

    //////////================= Adjustments for Swap Fee Calculation =============================
    //_defaultSwapFee is a percentage expressed percent hence we divide by 10000
    uint private _defaultSwapFee; // 1% = 100
    //_referredDiscountRatio is a percentage expressed a percent hence we divide by 10000
    uint private _referredDiscountRatio;
    //_adminProfitRatio is a percentage expressed in 1/100 (a tenth) of a percent hence we divide by 100
    uint private _adminProfitRatio;
    //_assistProfitRatio is a percentage expressed in 1/100 (a tenth) of a percent hence we divide by 100
    uint private _assistProfitRatio;
    //_referrerProfitRatio is a percentage expressed in 1/100 (a tenth) of a percent hence we divide by 100
    uint private _referrerProfitRatio;
    
    //Wallets where fees will go
    /// Only Contract owner can change this variable using setAdminFeeWallet() method.
    address payable private _feesAdminWallet;
    /// Only Contract owner can change this variable using setAssistWallet() method.
    address payable private _feesAssistWallet;

    //////////================= History of Swap ====================================================
    //Global swap id. Also give total number of swaps made so far
    uint256 private _swapId;
    uint256 private _totalVolume;
    // swap history
    mapping(uint256 => Swap) private _swaps;
    
    //////////================= Referral Systems ====================================================
    /// referral codes => balance of swap fee
    mapping (bytes8 => uint256) private _referalFees;
    /// referral codes -> wallet address
    mapping (bytes8 => address) private _referrerWallets;
    mapping (string => bytes8) private _referralCodes;
    /// minimum amount that referer can withdraw. default value is 1 eth.
    /// Admin can adjust this variable using setMinimumClaimable() method
    uint256 private _minReferrerClaimable;

    //////////================= Events ====================================================
    /// swap id, trader
    event DoSwap(uint256 id, address indexed trader);
    event AdminWalletChanged(address indexed wallet);
    event AssistWalletChanged(address indexed wallet);
    event UserFeeChanged(address user, uint256 fee);
    event ReferredRegistered(address referrer, address referred);
    event AdminRegistered(address admin);
    event MinimumClaimableChanged(uint256 minAmount);
    event ReferrerClaimedProfit(address user, uint256 amount);
    event ReferralCodeGenerated(string discordID, bytes8 referralCode);
    //////////================= Modifiers & Initializers ====================================================
    modifier onlyContract(address account) {
        require( account.isContract(), "[Validation] The address does not contain a contract");
        _;
    }

    modifier onlySuccessSwaps(uint256 id) {
        Swap memory swap = _swaps[id];
        require(swap.status == Status.FAILED);
        _;
    }
    /**
     * @dev Throws if called by any account other than the owner or admin.
     */
    modifier onlyAdmin() {
        require(owner() == _msgSender() || _admin == _msgSender(), "AsapSwap: caller is not the Admin or owner");
        _;
        
    }

    /**
     * @dev initialize
     */
    function initialize(
        address payable adminWallet,
        address payable assistWallet,
        address wethAddress
    ) public {
        __AsapSwap_init(adminWallet, assistWallet, wethAddress);
    }

    function __AsapSwap_init(
        address payable adminWallet,
        address payable assistWallet,
        address wethAddress
    ) internal initializer {
        _totalVolume = 0;
        _swapId = 0;
        _defaultSwapFee = 100;
        _adminProfitRatio = 85;
        _assistProfitRatio = 15;
        _referrerProfitRatio = 20;
        _referredDiscountRatio = 5;
        _minReferrerClaimable = 1000000000000000000;
        _admin = owner();
        __Context_init_unchained();
        __Ownable_init_unchained();
        __Pausable_init_unchained();
        __AsapSwap_init_unchained(adminWallet, assistWallet, wethAddress);
    }

    function __AsapSwap_init_unchained(
        address payable adminWallet,
        address payable assistWallet,
        address  wethAddress
    ) internal initializer {
        require( adminWallet != address(0), "[Validation] adminWallet is the zero address");
        require( assistWallet != address(0), "[Validation] assistWallet is the zero address");

        _feesAdminWallet = adminWallet;
        _feesAssistWallet = assistWallet;
        _wethContractAddress = wethAddress;
    }

    /**
     * @dev Called by an admin to pause, triggers stopped state.
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Called by an admin to unpause, returns to normal state.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Allows owner to set admin wallet
     * @param wallet New wallet address
     */
    function setAdminUser(address payable wallet) external onlyOwner {
        require( wallet != address(0), "[Validation] wallet is the zero address" );
        _admin = wallet;
        emit AdminRegistered(wallet);
    }
    function check(
        uint256 id
    )
        external
        view
        returns (
            address trader,
            address token,
            uint256 fromTokenAmount,
            uint256 toTokenAmount,
            bytes8 referralCode,
            SwapType swapType,
            Status status
        )
    {
        Swap memory swapInfo = _swaps[id];
        return (
            swapInfo.trader,
            swapInfo.token,
            swapInfo.fromTokenAmount,
            swapInfo.toTokenAmount,
            swapInfo.referralCode,
            swapInfo.swapType,
            swapInfo.status
        );
    }
    function totalVolume() public view returns(uint256){
        return _totalVolume;
    }
    function tradeAmount() public view returns(uint256){
        return _swapId;
    }
    //////////================= Methods for adjustments of swap fee calculations =========================================
    function setSwapRatio(uint defaultSwapFee, uint adminProfit, uint assitProfit, uint referrerProfit, uint referredDiscount) external onlyAdmin {
        _defaultSwapFee = defaultSwapFee;
        _adminProfitRatio = adminProfit;
        _assistProfitRatio = assitProfit;
        _referrerProfitRatio = referrerProfit;
        _referredDiscountRatio = referredDiscount;
    }
    /**
     * @dev Allows admin to set fee receiver wallet
     * @param wallet New wallet address
     */
    function setAdminFeeWallet(address payable wallet) external onlyOwner {
        require( wallet != address(0), "[Validation] feesWallet is the zero address" );
        _feesAdminWallet = wallet;
        emit AdminWalletChanged(wallet);
    }

    /**
     * @dev Allows admin to set fee receiver wallet
     * @param wallet New wallet address
     */
    function setAssistWallet(address payable wallet) external onlyOwner {
        require( wallet != address(0), "[Validation] devWallet is the zero address" );
        _feesAssistWallet = wallet;
        emit AssistWalletChanged(wallet);
    }
    
    /**
     * @dev Allows admin to set weth token address
     * @param wethAddress contract address
     */
    function setWethAddress(address wethAddress) external onlyOwner {
        require( wethAddress != address(0), "[Validation] wethAddress is the zero address" );
        _wethContractAddress = wethAddress;
        emit AssistWalletChanged(wethAddress);
    }

    //////////================= Referral Systems =========================================
    function setMinimumClaimable(uint256 minAmount) external  onlyAdmin{
        _minReferrerClaimable = minAmount;
        emit MinimumClaimableChanged(minAmount);
    }
    /// generate unique referral code for discord id.
    function generateReferralCode(string calldata discordID) external {
         bytes8 referralCode = bytes8(keccak256(abi.encodePacked(discordID, _msgSender())));
         if(_referrerWallets[referralCode] == address(0)){
            _referralCodes[discordID] = referralCode;
             _referrerWallets[referralCode] = _msgSender();
             _referalFees[referralCode] = 0;
             emit ReferralCodeGenerated(discordID, referralCode);
         }
         require( _referrerWallets[referralCode] == _msgSender(), "[Validation] This discord ID is registered for other wallet." );                 
    }
    function getReferralCode(string memory discordID) public view returns(bytes8){

         return  _referralCodes[discordID]; 
    }
    function getClaimableAmount(bytes8 referralCode) public view returns(uint256)
    {
         require( _referrerWallets[referralCode] == _msgSender(), "[Validation] Referral code is not registered for this user" );
         return  _referalFees[referralCode];
    }
    /// change user's default wallet
    /// if caller is referrer, change wallet address for referral code
    function changeUserWallet(address newWallet, bytes8  referralCode) external {
        require( _referrerWallets[referralCode] == _msgSender(), "[Validation] It's not your referral code" );
        _referrerWallets[referralCode] = newWallet;
    }

    function getReferrer(bytes8  referralCode ) public view returns(address){
        return  _referrerWallets[referralCode];
    }
    
    function ClaimReferrerProfit(bytes8  referralCode ) external payable{
        require( _referrerWallets[referralCode] == _msgSender(), "[Validation] It's not your referral code" );
        require( _referalFees[referralCode] >= _minReferrerClaimable, "[Validation] referrer has not enough balance to claim" );
        TransferHelper.safeTransferETH(_msgSender(), _referalFees[referralCode]);
        emit ReferrerClaimedProfit(_msgSender(), _referalFees[referralCode]);
        _referalFees[referralCode] = 0;
    }

    function getFee(uint256 amount, bytes8 referralCode) public view returns (uint256) {
        uint _feePercentage = _defaultSwapFee;
        if (_referrerWallets[referralCode] != address(0)) _feePercentage = _feePercentage - _referredDiscountRatio;
        return amount.mul(_feePercentage).div(10000); 
    }

    function _distributeFees(uint256 fee, bytes8 referralCode) private {
        uint256 _referrerFee = 0;
        if (_referrerWallets[referralCode] != address(0)){
            _referrerFee = fee.mul(_referrerProfitRatio).div(100);
            _referalFees[referralCode] = _referalFees[referralCode].add(_referrerFee);
        } 
        uint256 admin_fee = fee.sub(_referrerFee).mul(_adminProfitRatio).div(100); //85%
        uint256 assit_fee = fee.sub(_referrerFee).mul(_assistProfitRatio).div(100); //15%

        TransferHelper.safeTransferETH(_feesAdminWallet, admin_fee);
        TransferHelper.safeTransferETH(_feesAssistWallet, assit_fee);
    }
    //////////================= Swap related methods =========================================
    function SwapEthToToken(
        address tokenContract,
        address pairFor,
        bytes8 referralCode
    ) external payable whenNotPaused {
        require( msg.value > 0, "[Validation] The trade amount has to be larger than 0" );
        _swapEthToToken( msg.value, tokenContract, pairFor, referralCode);
    }

    function SwapTokenToEth(
        uint256 tokenAmount,
        address tokenContract,
        address pairFor,
        bytes8 referralCode

    ) external payable whenNotPaused {
        require(
            tokenAmount > 0,
            "[Validation] The trade amount has to be larger than 0"
        );
        _swapTokenToEth( tokenAmount, tokenContract, pairFor, referralCode);
    }

    function _swapEthToToken(
        uint256 ethAmount,
        address toTokenContract,
        address pairFor,
        bytes8 referralCode
    ) private whenNotPaused onlyContract(toTokenContract) {
        _totalVolume = _totalVolume.add(ethAmount);
        uint256 totalfeeInSwap = getFee(ethAmount, referralCode);
        uint256 buyAmount = ethAmount.sub(totalfeeInSwap);
        //uint256 _estimatedTokenAmount = 0;//getEstimatedERC20forETH( buyAmount, toTokenContract);
            // if (minOutput > 0) {
            //     require( minOutput < _estimatedTokenAmount, "[Validation] Token price is too high ");
            // }
        IERC20 tokenContract = IERC20(toTokenContract);
        // send eth to pair contract
        IWETH(_wethContractAddress).deposit{value: buyAmount}();
        assert(IWETH(_wethContractAddress).transfer( pairFor, buyAmount));
        // token balance before swap
        uint balanceBefore = tokenContract.balanceOf(_msgSender());
        /// swap
        {
            (address input, address output) = (_wethContractAddress, toTokenContract);
            (address token0, ) = sortTokens(input, output);
            IUniswapV2Pair pair = IUniswapV2Pair(pairFor);
            uint amountInput;
            uint amountOutput;
            // scope to avoid stack too deep errors
            (uint reserveInput, uint reserveOutput) = getReserves( input, output, address(pair));
            amountInput = IERC20(input).balanceOf(address(pair)).sub( reserveInput);
            amountOutput = getAmountOut( amountInput, reserveInput, reserveOutput);
            (uint amount0Out, uint amount1Out) = _wethContractAddress == token0 ? (uint(0), amountOutput) : (amountOutput, uint(0));
            pair.swap(amount0Out, amount1Out, _msgSender(), new bytes(0));
        }
        uint outTokenAmount = tokenContract.balanceOf(_msgSender()).sub(balanceBefore);
        _distributeFees(totalfeeInSwap, referralCode);
        _swapId = _swapId.add(1);
        _swaps[_swapId] = Swap({ fromTokenAmount: ethAmount, toTokenAmount: outTokenAmount, trader: _msgSender(), token: toTokenContract, swapType: SwapType.ETH_TO_ERC20, status: Status.SUCCESS, referralCode:referralCode });
        emit DoSwap(_swapId, _msgSender());
    }

    function _swapTokenToEth(
        uint256 tokenAmount,
        address fromTokenContract,
        address pairFor,
        bytes8 referralCode
    ) private whenNotPaused onlyContract(fromTokenContract) {
        require( tokenAmount > 0, "[Validation] The ERC-20 amount has to be larger than 0");

        IUniswapV2Pair pair =  IUniswapV2Pair(pairFor);
        TransferHelper.safeTransferFrom(
            fromTokenContract, _msgSender(), pairFor, tokenAmount
        );
        
        uint256 beforeSwap = IERC20(_wethContractAddress).balanceOf(address(this));
        // swap ether for tokens
        {
            (address token0, ) = sortTokens(fromTokenContract, _wethContractAddress);
            // scope to avoid stack too deep errors
            (uint reserveInput, uint reserveOutput) = getReserves( fromTokenContract, _wethContractAddress, pairFor);
            uint amountInput = IERC20(fromTokenContract).balanceOf(pairFor).sub(reserveInput);
            uint amountOutput = getAmountOut( amountInput, reserveInput, reserveOutput);
            (uint amount0Out, uint amount1Out) = fromTokenContract == token0? (uint(0), amountOutput): (amountOutput, uint(0));
            pair.swap(amount0Out, amount1Out, address(this), new bytes(0));
        }
        // withdraw ether for tokens
        uint256 ethOut=0;
        {
            ethOut = IERC20(_wethContractAddress).balanceOf(address(this)) - beforeSwap;
            // require( ethOut >= minOutput, "ASAP BOT: Swapped ether amount is less than minimum expect");
            IWETH(_wethContractAddress).withdraw(ethOut);
           _totalVolume = _totalVolume.add(ethOut);
            uint256 swapFee =  getFee(ethOut, referralCode);
            ethOut = ethOut - swapFee;
             
            TransferHelper.safeTransferETH(_msgSender(), ethOut);
            _distributeFees(swapFee, referralCode);
        }

        _swapId = _swapId.add(1);
        // Store the details of the swap.
        _swaps[_swapId] = Swap({fromTokenAmount: tokenAmount, toTokenAmount: ethOut, trader: _msgSender(), token: fromTokenContract, swapType: SwapType.ERC20_TO_ETH, status: Status.SUCCESS,referralCode:referralCode});
        emit DoSwap(_swapId, _msgSender());
    }

    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountIn) {
        require(amountOut > 0, "ASAP BOT: INSUFFICIENT_OUTPUT_AMOUNT");
        require(
            reserveIn > 0 && reserveOut > 0,
            "ASAP BOT: INSUFFICIENT_LIQUIDITY"
        );
        uint256 numerator = reserveIn.mul(amountOut).mul(1000);
        uint256 denominator = reserveOut.sub(amountOut).mul(997);

        amountIn = (numerator / denominator).add(1);
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) internal pure returns (uint amountOut) {
        require(amountIn > 0, "ASAP BOT: INSUFFICIENT_INPUT_AMOUNT");
        require(
            reserveIn > 0 && reserveOut > 0,
            "ASAP BOT: INSUFFICIENT_LIQUIDITY"
        );
        uint amountInWithFee = amountIn.mul(997);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(1000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    function getAmountsIn(
        uint256 amountOut,
        address pairFor,
        address[] memory path
    ) internal view returns (uint256[] memory amounts) {
        require(path.length >= 2, "ASAP BOT: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[1] = amountOut;
        (uint256 reserve0, uint256 reserve1) = getReserves(path[0], path[1], pairFor);
        amounts[0] = getAmountIn(amounts[1], reserve0, reserve1);
    }

    // returns sorted token addresses, used to handle return values from pairs sorted in this order
    function sortTokens(
        address tokenA,
        address tokenB
    ) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "ASAP BOT: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        require(token0 != address(0), "ASAP BOT: ZERO_ADDRESS");
    }

    function getEstimatedETHforERC20(
        uint256 erc20Amount,
        address tokenAddress,
        address pairFor
    ) public view returns (uint256) {
        uint256 _estimatedTokenAmount = getAmountsIn(erc20Amount, pairFor, getPathForETHtoERC20(tokenAddress))[0];
        return _estimatedTokenAmount;
    }

    function getPathForETHtoERC20(
        address tokenAddress
    ) internal view returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = _wethContractAddress;
        path[1] = tokenAddress;
        return path;
    }

    function getEstimatedERC20forETH(
        uint256 etherAmount,
        address tokenAddress,
        address pairFor
    ) public view returns (uint256) {
        uint256 _estimatedTokenAmount = getAmountsIn(etherAmount, pairFor,getPathForERC20toETH(tokenAddress)
        )[0];

        return _estimatedTokenAmount;
    }
    function getPathForERC20toETH(
        address tokenAddress
    ) internal view returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = tokenAddress;
        path[1] = _wethContractAddress;
        return path;
    }

    function getReserves(
        address tokenA,
        address tokenB,
        address pariFor
    ) internal view returns (uint reserveA, uint reserveB) {
        (address token0, ) = sortTokens(tokenA, tokenB);
        (uint reserve0, uint reserve1, ) = IUniswapV2Pair(pariFor).getReserves();
        (reserveA, reserveB) = tokenA == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
    }
    receive() external payable {
        assert(_msgSender() == _wethContractAddress); // only accept ETH via fallback from the WETH contract
    }
    fallback() external payable {}
}
