const { ethers } = require("ethers");

const items = {

	EXIT_CODE_OK: 0,
	EXIT_CODE_INTERNAL: 1,
	EXIT_CODE_CONFIG: 2,
	EXIT_CODE_NETWORK: 3,
	EXIT_CODE_USER_ERROR: 4,
	EXIT_CODE_NODE: 5,

	LATEST_CONFIG_VERSION: 7,

	LIQUIDITY_MODE_REGULAR: 0,
	LIQUIDITY_MODE_MEMPOOL: 1,

	TRANSACTION_MODE_REGULAR: 0,
	TRANSACTION_MODE_DXSALE: 1,
	TRANSACTION_MODE_PINKSALE: 2,
	DEAD_ADDRESS: '0x000000000000000000000000000000000000dEaD',
	ERC20_TRANSFER_METHOD: '0xa9059cbb',
	TEAM_FINANCE_LOCKER_ADDRESS: '0xe2fe530c047f2d85298b07d9333c05737f1435fb',
	TEAM_FINANCE_LOCK_METHOD: '0x5af06fed',
	TEAM_FINANCE_ABI: [
		{ "inputs": [{ "internalType": "address", "name": "_tokenAddress", "type": "address" }], "name": "getTotalTokenBalance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
	],
	UNICRYPT_LOCKER_ADDRESS: '0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214',
	UNICRYPT_LOCK_METHOD: '0x8af416f6',
	UNICRYPT_ABI: [
		{ "inputs": [{ "internalType": "address", "name": "_lpToken", "type": "address" }], "name": "getNumLocksForToken", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
		{ "inputs": [{ "internalType": "address", "name": "", "type": "address" }, { "internalType": "uint256", "name": "", "type": "uint256" }], "name": "tokenLocks", "outputs": [{ "internalType": "uint256", "name": "lockDate", "type": "uint256" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "uint256", "name": "initialAmount", "type": "uint256" }, { "internalType": "uint256", "name": "unlockDate", "type": "uint256" }, { "internalType": "uint256", "name": "lockID", "type": "uint256" }, { "internalType": "address", "name": "owner", "type": "address" }], "stateMutability": "view", "type": "function" }
	],
	ADD_LIQUIDITY_FUNC: '0xe8e33700',
	ADD_LIQUIDITY_ETH_FUNC: '0xf305d719',
	ADD_LIQUIDITY_AVAX_FUNC: '0xf91b3f72',
	ADD_LIQUIDITY_BURNT_FUNC: '0x02751cec',
	REMOVE_LIQUIDITY_FUNCS: [
		{ method: 'removeLiquidity', hex: '0xbaa2abde' },//removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline)
		{ method: 'removeLiquidityETH', hex: '0x02751cec' },//removeLiquidityETH(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline)
		{ method: 'removeLiquidityWithPermit', hex: '0x2195995c' },//removeLiquidityWithPermit(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s)
		{ method: 'removeLiquidityETHWithPermit', hex: '0xded9382a' },//removeLiquidityETHWithPermit(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s)
		{ method: 'removeLiquidityETHSupportingFeeOnTransferTokens', hex: '0xaf2979eb' },//removeLiquidityETHSupportingFeeOnTransferTokens(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline)
		{ method: 'removeLiquidityETHWithPermitSupportingFeeOnTransferTokens', hex: '0x5b0d5984' },//removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s)
	],
	ALERT_IGNORE_TIMES: {
		CHANNEL_NEW_LIQUIDTY: 3600 * 24 * 7,//7 days
		CHANNEL_LOCKED_LIQUIDITY: 3600 * 24 * 7,//7 days
		CHANNEL_OPEN_TRADING: 3600 * 24 * 7,//7 days
		CHANNEL_BURNT_ALERT: 3600 * 24 * 7 //7 days
	},

	ASAP_SWAP_ETH_TO_TOKEN: `0x2cff306b`,
	ASAP_SWAP_TOKEN_TO_ETH: `0xfa0c6257`,

	UNISWAP_METHODS: [
		{
			method: 'swapExactETHForTokens',
			hex: `0x7ff36ab5`
		},
		{
			method: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
			hex: `0x5c11d795`
		},
		{
			method: 'swapExactTokensForTokens',
			hex: `0x38ed1739`
		},
		{
			method: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
			hex: `0x791ac947`
		},
		{
			method: 'swapExactTokensForETH',
			hex: `0x18cbafe5`
		},
		{
			method: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
			hex: `0xb6f9de95`
		},
		{
			method: 'swapETHForExactTokens',
			hex: `0xfb3bdb41`
		},
		{
			method: 'swapTokensForExactETH',
			hex: `0x4a25d94a`
		},
		{
			method: 'swapTokensForExactTokens',
			hex: `0x8803dbee`
		},
		{
			method: 'addLiquidity',
			hex: `0xe8e33700`
		},
		{
			method: 'addLiquidityETH',
			hex: `0xf305d719`
		},
	],
	ASAPUTILS_ABI: `[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"buyGas","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"sellGas","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"estimatedBuy","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"exactBuy","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"estimatedSell","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"exactSell","type":"uint256"}],"name":"CheckEvent","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[{"internalType":"address","name":"dexRouter","type":"address"},{"internalType":"address","name":"mainToken","type":"address"},{"internalType":"address","name":"targetToken","type":"address"}],"name":"check","outputs":[{"components":[{"internalType":"uint256","name":"buyGas","type":"uint256"},{"internalType":"uint256","name":"sellGas","type":"uint256"},{"internalType":"uint256","name":"estimatedBuy","type":"uint256"},{"internalType":"uint256","name":"exactBuy","type":"uint256"},{"internalType":"uint256","name":"estimatedSell","type":"uint256"},{"internalType":"uint256","name":"exactSell","type":"uint256"}],"internalType":"struct AsapUtils.CheckerResponse","name":"","type":"tuple"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"destroy","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}]`,
	UNISWAP_ABI: [
		'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
		'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
		'function addLiquidity( address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline ) external returns (uint amountA, uint amountB, uint liquidity)',
		'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
		'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
		'function addLiquidityETH( address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline ) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
		'function removeLiquidity(  address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB)',
		'function removeLiquidityETH( address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline ) external returns (uint amountToken, uint amountETH)',
		'function removeLiquidityWithPermit( address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s ) external returns (uint amountA, uint amountB)',
		'function removeLiquidityETHWithPermit( address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s ) external returns (uint amountToken, uint amountETH)',
		'function removeLiquidityETHSupportingFeeOnTransferTokens( address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline ) external returns (uint amountETH)',
		'function removeLiquidityETHWithPermitSupportingFeeOnTransferTokens( address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline, bool approveMax, uint8 v, bytes32 r, bytes32 s ) external returns (uint amountETH)',
		'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
		'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
		'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
		'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline ) external returns (uint[] memory amounts)',
		'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
		'function swapTokensForExactTokens( uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline ) external returns (uint[] memory amounts)'
	],

	ADD_LIQUIDITY_UNK_FUNC: '0x267dd102',
	ADD_LIQUIDITY_UNK2_FUNC: '0xe8078d94',


	CREATE_PAIR_FUNC: '0xc9c65396',

	DEFAULT_GAS_LIMIT: 600000,
	APPROVE_AMOUNT: `115792089237316195423570985008687907853269984665640564039457584007913129639935`,

	SWAP_CONTRACT_ABI: `[
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "admin",
					"type": "address"
				}
			],
			"name": "AdminRegistered",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": true,
					"internalType": "address",
					"name": "wallet",
					"type": "address"
				}
			],
			"name": "AdminWalletChanged",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": true,
					"internalType": "address",
					"name": "wallet",
					"type": "address"
				}
			],
			"name": "AssistWalletChanged",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "id",
					"type": "uint256"
				},
				{
					"indexed": true,
					"internalType": "address",
					"name": "trader",
					"type": "address"
				}
			],
			"name": "DoSwap",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "string",
					"name": "discordID",
					"type": "string"
				},
				{
					"indexed": false,
					"internalType": "bytes8",
					"name": "referralCode",
					"type": "bytes8"
				}
			],
			"name": "GenerateReferralCode",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "minAmount",
					"type": "uint256"
				}
			],
			"name": "MinimumClaimableChanged",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": true,
					"internalType": "address",
					"name": "previousOwner",
					"type": "address"
				},
				{
					"indexed": true,
					"internalType": "address",
					"name": "newOwner",
					"type": "address"
				}
			],
			"name": "OwnershipTransferred",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "account",
					"type": "address"
				}
			],
			"name": "Paused",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "referrer",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "address",
					"name": "referred",
					"type": "address"
				}
			],
			"name": "ReferredRegistered",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "user",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "amount",
					"type": "uint256"
				}
			],
			"name": "ReferrerClaimedProfit",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "account",
					"type": "address"
				}
			],
			"name": "Unpaused",
			"type": "event"
		},
		{
			"anonymous": false,
			"inputs": [
				{
					"indexed": false,
					"internalType": "address",
					"name": "user",
					"type": "address"
				},
				{
					"indexed": false,
					"internalType": "uint256",
					"name": "fee",
					"type": "uint256"
				}
			],
			"name": "UserFeeChanged",
			"type": "event"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "newWallet",
					"type": "address"
				},
				{
					"internalType": "bytes8",
					"name": "referralCode",
					"type": "bytes8"
				}
			],
			"name": "changeUserWallet",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "bytes8",
					"name": "referralCode",
					"type": "bytes8"
				}
			],
			"name": "ClaimReferrerProfit",
			"outputs": [],
			"stateMutability": "payable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "string",
					"name": "discordID",
					"type": "string"
				}
			],
			"name": "generateReferralCode",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address payable",
					"name": "adminWallet",
					"type": "address"
				},
				{
					"internalType": "address payable",
					"name": "assistWallet",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "wethAddress",
					"type": "address"
				}
			],
			"name": "initialize",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "pause",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "renounceOwnership",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address payable",
					"name": "wallet",
					"type": "address"
				}
			],
			"name": "setAdminFeeWallet",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address payable",
					"name": "wallet",
					"type": "address"
				}
			],
			"name": "setAdminUser",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address payable",
					"name": "wallet",
					"type": "address"
				}
			],
			"name": "setAssistWallet",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "minAmount",
					"type": "uint256"
				}
			],
			"name": "setMinimumClaimable",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "defaultSwapFee",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "adminProfit",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "assitProfit",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "referrerProfit",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "referredDiscount",
					"type": "uint256"
				}
			],
			"name": "setSwapRatio",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "wethAddress",
					"type": "address"
				}
			],
			"name": "setWethAddress",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "tokenContract",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "pairFor",
					"type": "address"
				},
				{
					"internalType": "bytes8",
					"name": "referralCode",
					"type": "bytes8"
				}
			],
			"name": "SwapEthToToken",
			"outputs": [],
			"stateMutability": "payable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "tokenAmount",
					"type": "uint256"
				},
				{
					"internalType": "address",
					"name": "tokenContract",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "pairFor",
					"type": "address"
				},
				{
					"internalType": "bytes8",
					"name": "referralCode",
					"type": "bytes8"
				}
			],
			"name": "SwapTokenToEth",
			"outputs": [],
			"stateMutability": "payable",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "address",
					"name": "newOwner",
					"type": "address"
				}
			],
			"name": "transferOwnership",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"stateMutability": "payable",
			"type": "receive"
		},
		{
			"inputs": [],
			"name": "unpause",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		},
		{
			"stateMutability": "payable",
			"type": "fallback"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "id",
					"type": "uint256"
				}
			],
			"name": "check",
			"outputs": [
				{
					"internalType": "address",
					"name": "trader",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "token",
					"type": "address"
				},
				{
					"internalType": "uint256",
					"name": "fromTokenAmount",
					"type": "uint256"
				},
				{
					"internalType": "uint256",
					"name": "toTokenAmount",
					"type": "uint256"
				},
				{
					"internalType": "bytes8",
					"name": "referralCode",
					"type": "bytes8"
				},
				{
					"internalType": "enum AsapSwapV1.SwapType",
					"name": "swapType",
					"type": "uint8"
				},
				{
					"internalType": "enum AsapSwapV1.Status",
					"name": "status",
					"type": "uint8"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "bytes8",
					"name": "referralCode",
					"type": "bytes8"
				}
			],
			"name": "getClaimableAmount",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "bytes8",
					"name": "referralCode",
					"type": "bytes8"
				}
			],
			"name": "getClaimWallet",
			"outputs": [
				{
					"internalType": "address",
					"name": "",
					"type": "address"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "etherAmount",
					"type": "uint256"
				},
				{
					"internalType": "address",
					"name": "tokenAddress",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "pairFor",
					"type": "address"
				}
			],
			"name": "getEstimatedERC20forETH",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "erc20Amount",
					"type": "uint256"
				},
				{
					"internalType": "address",
					"name": "tokenAddress",
					"type": "address"
				},
				{
					"internalType": "address",
					"name": "pairFor",
					"type": "address"
				}
			],
			"name": "getEstimatedETHforERC20",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "uint256",
					"name": "amount",
					"type": "uint256"
				},
				{
					"internalType": "bytes8",
					"name": "referralCode",
					"type": "bytes8"
				}
			],
			"name": "getFee",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [
				{
					"internalType": "string",
					"name": "discordID",
					"type": "string"
				}
			],
			"name": "getReferralCode",
			"outputs": [
				{
					"internalType": "bytes8",
					"name": "",
					"type": "bytes8"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "owner",
			"outputs": [
				{
					"internalType": "address",
					"name": "",
					"type": "address"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "paused",
			"outputs": [
				{
					"internalType": "bool",
					"name": "",
					"type": "bool"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "totalVolume",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		},
		{
			"inputs": [],
			"name": "tradeAmount",
			"outputs": [
				{
					"internalType": "uint256",
					"name": "",
					"type": "uint256"
				}
			],
			"stateMutability": "view",
			"type": "function"
		}
	]`,

	TOKEN_ABI: [
		{ "inputs": [{ "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" },
		{ "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
		{ "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
		{ "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" },
		{ "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
		{ "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "pure", "type": "function" },
		{ "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
		{ "constant": true, "inputs": [], "name": "token0", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" },
		{ "constant": true, "inputs": [], "name": "token1", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }
	],


	REFERRAL_LINK_MAX_USE: 0,
	REFERRAL_LINK_EXPIRE_SEC: 0,


	MAX_CREATABLE_WALLET: 2,

	MEMBER_ADD_TYPE: {
		DIRECT: `direct`,
		REFERRAL: `referral`
	},

	TRADE_MODE: {
		BUY: `buy`,
		SELL: `sell`
	},

	TRADE_SORT: {
		MANUAL: `Manual Trade`,
		LIMIT_ORDER: `By Limit order`,
		SNIPE: `By Sniper`
	},

	UPDATE_DATA_BLOCKS:3, 
	ANALYZE_BLOCK_TIME_INTERVAL: 3000,
	BLOCK_FETCHING_STATUS: {
		NONE: 0,
		FETCHING_TXS: 1,
		ANALYZING: 2,
		UPDATING_TOKENS: 3,
		PROCESSING_LIMIT_ORDER: 4,
		COMPLETED: 5

	},
	MINIMUM_BALANCE_CHANGE: 0.01,
	ORDER_STATUS: {
		WAITING: 0,
		PENDING: 1,
		SUCCESS: 2,
		FAILED: 3,
		CANCELED: 4,
	},
	MAX_WALLETSIZE_METHODS: [
		'_maxWalletSize',
	],
	BLOCKED_FUNCTIONS: [
		'0x3c59639b',
		'0x9d83fc32',
		'0x0bffdcf4',
		'0xef176b98',
		'0x1507bd2f',
		'0x8f283970',
		'0x5932ead1',
		'0x357dae04',
		'0xba2a80ae',
		'0xdafd18e9',
		'0x96642ad9',
		'0xa1c17686',
		'0x57ae5708',
		'0x9d83fc32',
		'0x9d83fc32',

		// contract
		'60a060405260405162000d4b38038062000d4b83398101604081905262000026916200027b565b818484600362000037838262000394565b50600462000046828262000394565b50505060ff1660805280620000ae5760405162461bcd60e51b8152602060048201526024808201527f5374616e6461726445524332303a20737570706c792063616e6e6f74206265206044820152637a65726f60e01b60648201526084015b60405180910390fd5b620000ba3382620000c4565b5050505062000487565b6001600160a01b0382166200011c5760405162461bcd60e51b815260206004820152601f60248201527f45524332'
	],
	OPEN_TRADING_FUNCS: [
		'0xc9567bf9',
		'0x01339c21',
		'0x293230b8'
	],

	LIMIT_ORDER_TEST_TOKENS: [
		'0xbF7f4cdF6084d57e3bddc2Afa2308be72B0Ea087',
		'0x5EaEb4171b1f12884Bbf403b17B21B8BECC9dDA2',
		'0x73d5B2f081ceDf63A9e660a22088C7724aF78774',
		'0xE6550144ACD9954a5dA5a3eb4b8E2e09be13C0D9',
		'0x1a5A656851BDbf0ed39B9D404F188e67B2bB5cC5'
	],
	

	PNL_SORT: {
		jeet: {
			value: 0,
			background: `jeet.jpg`
		},
		chad: {
			value: 0,
			background: `chad.jpg`
		},
		giga: {
			value: 1000,
			background: `giga.jpg`
		}
	},
	PNL_DEFAUT_LINK: "https://discord.gg/Wbry4PTxxe"
}

module.exports = items;