/// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IWETH.sol";
import "./IERC20.sol";
import "./IRouter.sol";

contract AsapUtils is Ownable {
  
    constructor() {}

    uint256 MAX_INT = 2 ** 256 - 1;
    event CheckEvent(uint256 buyGas ,uint256 sellGas, uint256 estimatedBuy, uint256 exactBuy, uint256 estimatedSell, uint256 exactSell);

    struct CheckerResponse {
        uint256 buyGas;
        uint256 sellGas;
        uint256 estimatedBuy;
        uint256 exactBuy;
        uint256 estimatedSell;
        uint256 exactSell;
    }

    function destroy() external payable onlyOwner {
        address owner = owner();
        selfdestruct(payable(owner));
    }

    function _calculateGas(
        IRouter router,
        uint256 amountIn,
        address[] memory path
    ) internal returns (uint256) {
        uint256 usedGas = gasleft();

        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            0,
            path,
            address(this),
            block.timestamp + 100
        );

        usedGas = usedGas - gasleft();

        return usedGas;
    }

    function check(
        address dexRouter,
        address mainToken,
        address targetToken
    ) external payable returns (CheckerResponse memory) {
        IRouter _iRouter = IRouter(dexRouter);

        IERC20 _iMainToken = IERC20(mainToken);
        
        IWETH _iWeth = IWETH(mainToken);

        // buy simulation
        uint tokenBalance;
        address[] memory routePath = new address[](2);
        uint estimatedBuy;

        uint buyGas;
        uint exactBuy;
        {
            IERC20 _iTargetToken = IERC20(targetToken);
            _iWeth.deposit{value: msg.value}();
            _iMainToken.approve(dexRouter, MAX_INT);
            routePath[0] = mainToken;
            routePath[1] = targetToken;
            uint weth_balance = _iMainToken.balanceOf(address(this));
            estimatedBuy = _iRouter.getAmountsOut(msg.value, routePath)[1];
            tokenBalance = _iTargetToken.balanceOf(address(this));
            buyGas = _calculateGas(_iRouter, weth_balance, routePath);
            
            _iTargetToken.approve(dexRouter, MAX_INT);
            exactBuy = _iTargetToken.balanceOf(address(this)) - tokenBalance;
        }
        // sell simulation
        uint estimatedSell;
        uint sellGas;
        uint exactSell;
        {
            routePath[0] = targetToken;
            routePath[1] = mainToken;
            estimatedSell = _iRouter.getAmountsOut(exactBuy, routePath)[1];
            tokenBalance = _iMainToken.balanceOf(address(this));
            sellGas = _calculateGas(_iRouter, exactBuy, routePath);
            exactSell = _iMainToken.balanceOf(address(this)) - tokenBalance;
        }

        CheckerResponse memory response = CheckerResponse(
            buyGas,
            sellGas,
            estimatedBuy,
            exactBuy,
            estimatedSell,
            exactSell
        );
        emit CheckEvent(buyGas, sellGas, estimatedBuy, exactBuy, estimatedSell, exactSell);
        return response;
    }
}
