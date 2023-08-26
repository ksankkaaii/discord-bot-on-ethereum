const ethers = require('ethers');

const Network = require('./network.js');
const UniSwapUtils = require('./UniSwapUtils.js');

const constants = require('./constants.js');
const etherscan = new (require('./etherscan'))();

const { upsertToken, fetchTokenData } = require('./../services/tokendataService');

class TokenManger {

	constructor() {
		this.tokens = {}
	}

	createContract(tokenAddr) {
		return new ethers.Contract(
			tokenAddr,
			constants.TOKEN_ABI,
			this.network.networkaccount
		);
	}

	async init(account, chainId, networkInstance) {
		console.log(`Token manager is initializing...`);
		const registeredTokens = await fetchTokenData();

		registeredTokens.forEach((tokenData) => {
			this.tokens[tokenData?.tokenAddress] = { ...tokenData?.tokenData };
		});
		this.tokens = {}
		//this.uniSwapUtils = new UniSwapUtils( account, chainId);
		this.network = networkInstance;
		this.uniSwapUtils = networkInstance.uniSwapUtils;
	}

	async isContractVerified(token_address) {
		try {
			var contractverified = await etherscan.call({
				module: 'contract',
				action: 'getabi',
				address: token_address
			});
			return true;
		}
		catch (e) {
			return false;
		}

	}

	async fetchContractHolders(token_addr) {
		try {
			return await etherscan.call({
				module: 'token',
				action: 'tokenholderlist',
				contractaddress: token_addr,
				page: 1,
				offset: 10
			});
		}
		catch (e) {
			return [];
		}

	}

	async verifyLockedLiquidity(pair_address) {

		let _totalLocked = ethers.BigNumber.from('0');

		//_totalLocked = _totalLocked.add(30);

		// team finance
		try {
			_totalLocked = _totalLocked.add(await this.network.teamFinance.getTotalTokenBalance(pair_address));
		}
		catch (e) {
			console.log(`Get total token balance of pair(${pair_address}) from team finance failed with Error: ${e}`);
		}

		// unicrypt
		try {

			let lockedTokens = await this.network.uniCrypt.getNumLocksForToken(pair_address);

			if (lockedTokens.gt(0)) {

				for (let i = 0; i < lockedTokens; i++) {

					let lockInfo = await this.network.uniCrypt.tokenLocks(
						pair_address,
						i
					);

					_totalLocked = _totalLocked.add(lockInfo[1]);

				}
			}

		} catch (e) {
			console.log(`Get total token locks of pair(${pair_address}) from uniCrypt failed with Error: ${e}`);
		}

		return _totalLocked;
	}

	async computeSecurityScore(ctx, liquidity, verified) {

		let score = 0;

		// if liquidity > 5
		if (liquidity.gte(ethers.utils.parseEther('5'))) {
			score += 1;
		}
		// get total supply
		let totalSupply = await ctx.totalSupply();

		let maxWalletAllowed = await this.maxWalletTransaction(ctx);
		if (maxWalletAllowed) {

			let hundred = ethers.BigNumber.from('100');

			let percentage = hundred / totalSupply * maxWalletAllowed;

			if (percentage <= 2)
				score += 1;
		}
		let blFound = false;

		let bcode = await this.network.node.getCode(ctx.address);
		// loop through all standard blacklisted functions
		for (let i = 0; i < constants.BLOCKED_FUNCTIONS.length; i++) {

			let _func = constants.BLOCKED_FUNCTIONS[i];
			if (_func.startsWith('0x')) {
				_func = _func.substr(2, _func.length);
			}

			if (!bcode.toLowerCase().includes(_func.toLowerCase()))
				continue;

			blFound = true;

			return;
		}
		// no bl func found, add to score
		if (!blFound) {
			score += 1;
		}

		if (verified) {
			score += 1;
		}

		return score;

	}

	async maxWalletTransaction(_instance) {

		for (let i = 0; i < constants.MAX_WALLETSIZE_METHODS.length; i++) {

			try {

				let limit = await _instance[constants.MAX_WALLETSIZE_METHODS[i]]();

				return limit;

			} catch (err) {
				continue;
			}

		}

		return null;

	}

	get(tokenAddr) {
		if (!tokenAddr)
			return null;
		return this.tokens[tokenAddr];
	}

	async update(tokenAddr) {

		try {
			if (!tokenAddr)
				return null;
			let tokenData = this.tokens[tokenAddr];

			if (!tokenData) {

				tokenData = {
					address: tokenAddr,
					updateAt: this.network.Current_Block,
				};
				tokenData.ctx = this.createContract(tokenAddr);
				tokenData.pair = await this.uniSwapUtils.getPair(tokenAddr);
				tokenData.symbol = await tokenData.ctx.symbol();
				tokenData.decimals = await tokenData.ctx.decimals();
				tokenData.totalSupply = await tokenData.ctx.totalSupply();
				tokenData.updateFrom3rdAt = 0;
				tokenData.updateAt = 0;


			}
			else {
				tokenData.ctx = this.createContract(tokenAddr);
			}

			if (this.network.Current_Block - tokenData.updateAt > constants.UPDATE_DATA_BLOCKS) {

				tokenData.eth_liquidity = await this.uniSwapUtils.getLiquidity(tokenData.pair);
				tokenData.token_liquidity = await tokenData.ctx.balanceOf(tokenData.pair);
				const priceMultiplier = ethers.BigNumber.from(10).pow(tokenData.decimals);
				tokenData.price = tokenData.eth_liquidity.mul(priceMultiplier).div(tokenData.token_liquidity);
				tokenData.priceEth = ethers.utils.formatEther(tokenData.price);
				tokenData.updateAt = this.network.Current_Block;

				// Check honeypot
				try {
					const { buygas, sellgas, estimatedBuy, exactbuy, estimatedSell, exactSell } = await this.uniSwapUtils.CheckHoneypot(tokenAddr, this.network.network.chainId);

					tokenData.buygas = buygas;
					tokenData.sellgas = sellgas;
					tokenData.estimatedBuy = estimatedBuy;
					tokenData.exactbuy = exactbuy;
					tokenData.estimatedSell = estimatedSell;
					tokenData.exactSell = exactSell;

					const buyTax = (estimatedBuy.sub(exactbuy)).mul(100).div(estimatedBuy).toNumber();
					const sellTax = (estimatedSell.sub(exactSell)).mul(100).div(estimatedSell).toNumber();

					tokenData.buyTax = buyTax.toFixed(2) || `N/A`;
					tokenData.sellTax = sellTax.toFixed(2) || `N/A`;
					console.log(`buygas:${tokenData.buygas}\n sellgas:${tokenData.sellgas}\n estimatedBuy:${tokenData.estimatedBuy}\nexactBuy:${tokenData.exactbuy}\n estimatedSell:${tokenData.estimatedSell} \nexactSell:${tokenData.exactSell}\nbuyTax:${tokenData.buyTax}\n sellTax:${tokenData.sellTax}\n`);
					
					tokenData.honeypot = false;
				}
				catch (err) {
					console.log(`Checking honeypot failed with error: ${err}`);
					tokenData.honeypot = true;
				}
			}

			this.tokens[tokenAddr] = tokenData;
			tokenData = await this.updateFrom3rdParty(tokenAddr);
			await upsertToken(
				{
					tokenAddress: tokenAddr,
				},
				{
					pair: tokenData.pair,
					symbol: tokenData.symbol,
					decimals: tokenData.decimals,
					updateFrom3rdAt: tokenData.updateFrom3rdAt,
					updateAt: tokenData.updateAt,
					honeypot: tokenData.honeypot,
					buyTax: tokenData.buyTax,
					sellTax: tokenData.sellTax

				}
			);
			return tokenData;
		}
		catch (e) {
			console.log(`new token ${tokenAddr} is not registered because  ..` + e);
			throw `This token ${tokenAddr} is not valid. Error :` + e;
		}
		return null;
	}

	async fetchFromDexscreener(tokenAddress) {
		let fetch_try_count = 0
		while (true) {
			try {
				const apiUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
				const response = await fetch(apiUrl);

				const data = await response.json();
				return data?.pairs[0];//(data?.pairs && data?.pairs[0]) || null;
			}
			catch (err) {
				fetch_try_count = fetch_try_count + 1
				await this.wait(100);
				console.log("trying fetch data from dexscreener..." + err);
				if (fetch_try_count > process.env.FETCH_TRY_COUNT) return null;
			}
		}
	}

	async wait(seconds) {

		return new Promise((resolve, reject) => {

			setTimeout(() => {
				resolve();
			}, seconds * 1000)

		});

	}

	async fetchFromHoneypotis(tokenAddress, pairAddress) {
		let fetch_try_count = 0
		while (true) {
			try {
				if (tokenAddress && pairAddress) {
					const apiUrl = `https://api.honeypot.is/v2/IsHoneypot?address=${tokenAddress}&pair=${pairAddress}&chainID=1`;

					const response = await fetch(apiUrl);

					const data = await response.json();
					return data;
				}
				else {
					return null;
				}
			}
			catch (err) {
				fetch_try_count = fetch_try_count + 1
				await this.wait(100);
				console.log("trying fetch data from Honeypot..." + err);
				if (fetch_try_count > process.env.FETCH_TRY_COUNT) return null;
			}
		}
	}

	async updateFrom3rdParty(tokenAddr) {
		//let tokenData = await  this.update(tokenAddr);
		let tokenData = this.tokens[tokenAddr];
		console.log(`fetching token(${tokenData.address}) defail info fron contract ... `);
		try {

			if (!tokenData.creatorstats) {
				tokenData.creatorstats = await etherscan.call({
					module: 'contract',
					action: 'getcontractcreation',
					contractaddresses: tokenAddr
				});
				let txinfo = await this.network.node.getTransaction(tokenData.creatorstats[0].txHash);
				// fetch creation date
				tokenData.createBlock = await this.network.node.getBlock(txinfo.blockNumber);
				tokenData.verified = this.isContractVerified(tokenAddr) ? 'true' : 'false';
			}

			if (new Date().getTime() - tokenData.updateFrom3rdAt > 60 * 1000) // update data from 3rd every 60s
			{
				tokenData.contractholders = await this.fetchContractHolders(tokenAddr);
				tokenData.deployerBalance = await this.network.node.getBalance(tokenData.creatorstats[0].contractCreator);
				tokenData.deployerTxCount = await this.network.node.getTransactionCount(tokenData.creatorstats[0].contractCreator);
				tokenData.lockedLiquidity = await this.verifyLockedLiquidity(tokenData.pair);

				tokenData.security_score = await this.computeSecurityScore(tokenData.ctx, tokenData.eth_liquidity, tokenData.verified);

				const ethValue = await this.network.getETHtoUSD();
				if (tokenData.price && tokenData.totalSupply) {

					let totalSupply = ethers.utils.formatUnits(tokenData.totalSupply, tokenData.decimals);
					totalSupply = parseFloat(Number(totalSupply));

					let marketCapETHValue = ethers.utils.formatUnits((tokenData.price).mul(totalSupply), 18);
					let parsedMarketCapETHValue = parseFloat(Number(marketCapETHValue));

					if (ethValue) {
						tokenData.marketCap = isNaN((parsedMarketCapETHValue * ethValue / 1000)) ? `N/A` : `${(parsedMarketCapETHValue * ethValue / 1000).toFixed(2)}K USD`;
					}
					else {
						tokenData.marketCap = isNaN(parsedMarketCapETHValue) ? `N/A` : `${parsedMarketCapETHValue.toFixed(3)} ETH`;
					}
				}


				let parsedLiq = parseInt(Number(ethers.utils.formatUnits(tokenData.eth_liquidity, 18)));
				tokenData.liquidity = isNaN((parsedLiq * ethValue / 1000)) ? `N/A` : `${(parsedLiq * ethValue / 1000).toFixed(2)}K USD`

				tokenData.updateFrom3rdAt = new Date().getTime();
			}

			this.tokens[tokenAddr] = tokenData;
			console.log(`it is success to fetch token(${tokenData.address}) detail info from contract `);
			return tokenData;
		}
		catch (e) {
			console.log(`fetching token(${tokenData.address}) detail info from contract get failed. because ` + e);
			throw (e);
		}
		return null;

	}

	getTokenManager(tokenAddress) {
		try {
			const ctx = this.network.createContract(tokenAddress);
			return manager = new Contract(
				UniSwapUtils.weth,
				ctx,
				UniSwapUtils.router,
				UniSwapUtils.factory
			);
		}
		catch (err) {
			console.log(`Error getting token manager for ${tokenAddress}: ${err}`)
		}

		return null;
	}

	upsertTokenData(tokenAddress, updateData) {
		if (this.tokens[tokenAddress]) {
			this.tokens[tokenAddress] = { ...this.tokens[tokenAddress], ...updateData };
		}
		else {
			this.tokens[tokenAddress] = updateData;
		}
	}

	getToken(tokenAddress) {
		return tokens[tokenAddress];
	}

	async getPair(tokenAddress) {
		if (this.tokens[tokenAddress]?.pair) {
			console.log(`Pair in class is ${this.tokens[tokenAddress]?.pair}`);
			return this.tokens[tokenAddress]?.pair;
		}

		const tokenFromDB = await fetchToken(tokenAddress);
		if (tokenFromDB) {
			console.log(`Token pair Info from DB for token(${tokenAddress}) is ${tokenFromDB?.pair}`);
			this._upsertTokenData(tokenAddress, tokenFromDB);
			if (tokenFromDB?.pair) {
				return tokenFromDB?.pair;
			}
		}

		const pairFromContract = await this._getPairFromContract(tokenAddress);
		if (pairFromContract) {
			this._upsertTokenData(tokenAddress, { pair: pairFromContract });
			// Save to DB
			return pairFromContract;
		}

		throw new Error(`No pair found for the token(${tokenAddress})`);
	}

	async _getPairFromContract(tokenAddress) {
		try {
			const manager = this.getTokenManager(tokenAddress);
			return await manager.getPair();
		}
		catch {
			console.log(`Error getting pair of the token(${tokenAddress}) at getDecimalsFromContract(): ${error}`);
		}

		return ``;
	}

	async getDecimals(tokenAddress) {
		if (this.tokens[tokenAddress]?.deciamls) {
			return this.tokens[tokenAddress]?.deciamls;
		}

		const tokenFromDB = await fetchToken(tokenAddress);
		if (tokenFromDB) {
			console.log(`Token Decimals Info from DB for token(${tokenAddress}) is ${tokenFromDB?.deciamls}`);
			this._upsertTokenData(tokenAddress, tokenFromDB);
			if (tokenFromDB?.deciamls) {
				return tokenFromDB?.deciamls;
			}
		}

		const deciamlsFromContract = await this._getDecimalsFromContract(tokenAddress);
		if (deciamlsFromContract) {
			this._upsertTokenData(tokenAddress, { deciamls: deciamlsFromContract });
			// Save to DB
			return deciamlsFromContract;
		}

		throw new Error(`No decimals found for the token(${tokenAddress})`);
	}

	async _getDecimalsFromContract(tokenAddress) {
		try {
			const ctx = this.network.createContract(tokenAddress);
			const decimals = await ctx.decimals();
			console.log(`Decimals of the token(${tokenAddress}) at getDecimalsFromContract() is ${decimals}`);
			return decimals;
		}
		catch {
			console.log(`Error getting decimals of the token(${tokenAddress}) at getDecimalsFromContract(): ${error}`);
		}

		return 0;
	}

	async _getLiquidityFromContract(tokenAddress) {
		try {
			const manager = this.getTokenManager(tokenAddress);
			return await manager.getLiquidity(pair, 0)();
		}
		catch {
			console.log(`Error getting liquidity of the token(${tokenAddress}) at _getLiquidityFromContract(): ${error}`);
		}

		return 0;
	}
}

module.exports = TokenManger;