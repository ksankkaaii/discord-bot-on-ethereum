const Cryptr = require('cryptr');
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const QRCode = require('qrcode');

const moment = require('moment');

const Network = require('./network.js');
const UniSwapUtils = require('./UniSwapUtils.js');
//const { Network } = require('./main.js');
const ethers = require('ethers');
const constants = require('./constants.js');
const Helpers = require('./helpers');

const { setUserWallet, getUserInfo, getInviter, upsertAccountData } = require("./../services/accountService");
const { saveTokenInfoByInteraction } = require("./../services/interactionService");
const { registerHistory, getTradeInfo, getTradeInfoByTx } = require("./../services/tradehistoryService");

const {
	ButtonStyle,
	ButtonBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	SelectMenuBuilder,
	AttachmentBuilder,
	MessagePayload
} = require('discord.js');

const cryptr = new Cryptr(process.env.ENCRYPT_KEY, { pbkdf2Iterations: 10000, saltLength: 10 });
const canvasWidth = 750;
const canvasHeight = 423;

class ASAPUser {

	constructor(id, username) {

		this.discordId = id;
		this.username = username;
		this.config = {};

		this.defaultConfig = {
			inputAmount: null,
			sellPercentage: '10',
			slippage: '10',
			gasLimit: `${constants.DEFAULT_GAS_LIMIT}`,
			maxPriorityFee: ethers.utils.parseUnits('1', 'gwei'),
		};

		this.autoBuySettings = {
			autoBuying: false,
			requireVerified: false,
			requireHoneypotCheck: false,
			requireLiquidityLock: false,
			allowPrevContracts: false,

			minimumLockedLiq: ethers.utils.parseEther('0.0'),

			buyAmount: `0.0`,

			topHolderThreshold: '100',

			minimumLiquidity: ethers.utils.parseEther('0.0'),

			maximumBuyTax: '0',
			maximumSellTax: '0'
		}

		// network related
		this.account = null;

		this.contract = {
			ctx: null,
			manager: null,
			symbol: null,
			decimals: null,
			degenMode: false
		};

		this.tokenList = [];

		this.autoBoughtTokens = [];

		// private
		this.savedToken = null;
	}

	async init() {
		this.discordUser = await Network.discordClient.users.fetch(this.discordId);
		this.userInfo = await getUserInfo(this.discordId);
		if (this.userInfo && this.userInfo?.walletPrivateKey) {
			const oldWalletPK = cryptr.decrypt(this.userInfo?.walletPrivateKey);
			return await this.setWallet(oldWalletPK, this.userInfo?.walletChanged, this.discordUser.username);
		}


		return false;
	}

	isValidPrivateKey(key) {
		try {
			new ethers.Wallet(key);
			return true;
		} catch (err) {
			return false;
		}
	}

	isValidAddress(address) {
		return ethers.utils.isAddress(address);
	}

	async beforeChangeWallet(newPrvKey) {
		let res = {
			result: true,
			msg: ``
		};

		try {
			const newWallet = new ethers.Wallet(newPrvKey).connect(Network.node);
			const userInfo = await getUserInfo(this.discordId);

			const oldRefferCode = await this.getReferrerCodeFromContract();

			if (userInfo?.inviteCode != oldRefferCode) {
				await upsertAccountData(this.discordId, { inviteCode: oldRefferCode })
			}

			if (oldRefferCode == `` || oldRefferCode.startsWith(`0x0000`)) {
				return res;
			}

			//check balance 
			const balanceofOld = await Network.getBalnaceForETH(userInfo?.walletAddress);
			if (balanceofOld.gte(ethers.utils.parseUnits(`${constants.MINIMUM_BALANCE_CHANGE}`, 18))) {
				res.result = await this.changeUserWallet(newWallet.address, oldRefferCode);
			}
			else {
				console.log(`No Enough fund to beforeChangeWallet`);
				res.result = false;
				res.msg = `User(${this.discordId}) has invite code(${oldRefferCode}) in contract.\n
				No enough funds to change your wallet.\n
				Current Wallet(${this.account.address})'s balance is ${ethers.utils.formatEther(balanceofOld)}eth.\n.`
			}

		}
		catch (err) {
			console.log(`Error at beforeChangeWallet:  ${err}`);
			res.msg = err.toString();
			res.result = false;
		}

		return res;
	}

	async setWallet(private_key, walletChanged, discordName) {
		const newWallet = new ethers.Wallet(private_key).connect(Network.node);

		// store
		this.account = newWallet;

		// store in DB
		await setUserWallet(this.discordId, cryptr.encrypt(private_key), this.account.address, walletChanged, discordName);

		// set swap
		this.asapswap = new ethers.Contract(
			Network.asapswap.address,
			constants.SWAP_CONTRACT_ABI,
			this.account
		);
		//this.uniSwapUtils = new UniSwapUtils(this.account, Network.network.chainId);
		return true;
	}

	// async setContract(contract) {

	// 	this.contract.ctx = new ethers.Contract(
	// 		contract,
	// 		constants.TOKEN_ABI,
	// 		this.account
	// 	);

	// 	this.contract.symbol = await this.contract.ctx.symbol();
	// 	this.contract.decimals = await this.contract.ctx.decimals();

	// }

	async showStart(interaction, update = false) {
		await interaction.reply({ content: 'Fetching balance of your balance', ephemeral: true, fetchReply: true });

		let _balance = ethers.BigNumber.from(`0`);
		try {
			_balance = await Promise.race([
				this.account.getBalance(),
				new Promise((resolve, reject) => {
				  setTimeout(() => reject(new Error('Timeout')), 5000);
				})
			  ]);
		}
		catch(err) {
			console.log(`Fetching user balance failed with error: ${err}`);
			await interaction.editReply({ content: 'Fetching balance Failed, Please check your network and try again', ephemeral: true});
			return;
		}
		

		let comps = [
			new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Primary),
			),
			// new ActionRowBuilder().addComponents(
			// 	new ButtonBuilder().setCustomId('add_token_to_list').setLabel('Add Token to List').setStyle(ButtonStyle.Secondary),
			// 	new ButtonBuilder().setCustomId('clear_zero_balances').setLabel('Clear Zero Balances').setStyle(ButtonStyle.Secondary),
			// )
		];

		let content = {
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x000000)
					.setTitle('Main Menu')
					.setDescription(
						`
						Current wallet balance: **${ethers.utils.formatUnits(_balance, 18)} ETH**

					`
					)
			],
			components: comps,
			ephemeral: true
		};
		if (!update) {
			interaction.editReply(content);
		} else {
			interaction.editReply(content);
		}
	}

	async showAutoStart(interaction, update = false) {

		let desc = '';

		if(!this.autoBuySettings.autoBuying) {
			desc = `Auto buying is stopped.`;
		}
		else {
			desc = `Waiting for tokens..`;
		}

		let content = { 
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x000000)
					.setTitle('Auto Buying')
					.setDescription(desc)
			],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('start_auto').setLabel('Start').setStyle(ButtonStyle.Primary).setDisabled(this.autoBuySettings.autoBuying),
					new ButtonBuilder().setCustomId('stop_auto').setLabel('Stop').setStyle(ButtonStyle.Danger).setDisabled(!this.autoBuySettings.autoBuying)
				)
			],
			ephemeral: true
		};

		if(!update) {
			await interaction.reply(content);
		} else {
			await interaction.update(content);
		}
	}

	async showSettings(interaction, update = false) {
		const userInfo = await getUserInfo(this.discordId);

		let content = {
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x0099FF)
					.setTitle('Default Settings')
					.setDescription(
						`
						1. __Current Degen Wallet:__ **${this.account == null ? 'Not Set' : `[${this.account.address.replace(this.account.address.substr(5, this.account.address.length - 10), '...')}](https://etherscan.io/address/${this.account.address})`}**

						2. __Default Buy Amount (ETH):__ **${this.defaultConfig.inputAmount == null ? 'Not Set' : ethers.utils.formatUnits(this.defaultConfig.inputAmount.toString(), 18)}**

						3. __Default Sell Amount (%):__ **${this.defaultConfig.sellPercentage == null ? 'Not Set' : this.defaultConfig.sellPercentage}%**

						4. __Default Max Priority Fee:__ **${this.defaultConfig.maxPriorityFee == null ? 'Not Set' : ethers.utils.formatUnits(this.defaultConfig.maxPriorityFee, 'gwei') + ' gwei'}**

						5. __Current Invite Link:__ **${userInfo?.referralLink ? userInfo?.referralLink : 'Not Set'}**

						6. __Current Invite Counts:__ **${userInfo?.joiners ? userInfo?.joiners?.length : '0'}**
					`
					)
			],
			components: [
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('set_wallet').setLabel('1. Set Default Wallet')
						.setStyle(this.account == null ? ButtonStyle.Primary : ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('set_input').setLabel('2. Set Input Amount')
						.setStyle(this.defaultConfig.inputAmount == null ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled((this.account == null)),

				),
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('set_sell_percentage').setLabel('3. Set Default Sell Percentage')
						.setStyle((this.defaultConfig.sellPercentage == null) ? ButtonStyle.Primary : ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('set_priority_fee').setLabel('4. Set Default Priority Fee')
						.setStyle(this.defaultConfig.maxPriorityFee == null ? ButtonStyle.Primary : ButtonStyle.Secondary)
				)
			],
			ephemeral: true
		};

		if (update) {
			await interaction.update(content);
		} else {
			await interaction.reply(content);
		}
	}

	async showOrderSetting(interaction) {
		try {
			this.setOrder = true;
			let content = {
				content: '',
				embeds: [
					new EmbedBuilder()
						.setColor(0x0099FF)
						.setTitle('Limit Order Settings')
						.setDescription(`
							Please insert new limit order.
						`)
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId('set_limit_order_buy').setLabel('Set Order For Buying').setStyle(ButtonStyle.Primary),
						new ButtonBuilder().setCustomId('set_limit_order_sell').setLabel('Set Order For Selling').setStyle(ButtonStyle.Primary),
					)
				],
				ephemeral: true
			};

			await interaction.reply(content);
			// await Network.main_channel.send(content);
		}
		catch (err) {
			console.log("error in showOrderSetting: " + err);
		}
	}

	async showSelectOrder(interaction, tokenAddress) {
		try {
			let content = {
				content: '',
				embeds: [
					new EmbedBuilder()
						.setColor(0x0099FF)
						.setTitle('Limit Order Settings on Tokens')
						.setDescription(`
							Set limit order for buying or selling.
						`)
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId('show_select_order_buy').setLabel('Set Order For Buying').setStyle(ButtonStyle.Primary),
						new ButtonBuilder().setCustomId('show_select_order_sell').setLabel('Set Order For Selling').setStyle(ButtonStyle.Primary),
						new ButtonBuilder().setCustomId('show_select_order_list').setLabel('Show Order List').setStyle(ButtonStyle.Success),
					)
				],
				ephemeral: true
			};

			await interaction.reply(content);

		}
		catch (err) {
			console.log("Error when showSelectOrder :" + err);
		}
	}

	async showAutoBuyFilters(interaction, update = false) {

		let content = {
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x0099FF)
					.setTitle('Autobuy Settings')
					.setDescription(
						`
						**Toggles**

						Require Verified Contract: **${this.autoBuySettings.requireVerified ? 'true' : 'false'}**
						Require Honeypot / Tax Check: **${this.autoBuySettings.requireHoneypotCheck ? 'true' : 'false'}**
						Require Liquidity Lock: **${this.autoBuySettings.requireLiquidityLock ? 'true' : 'false'}**
						Allow Previously Deployed Contracts: **${this.autoBuySettings.allowPrevContracts ? 'true' : 'false'}**

						**Configuration**

						Buy Amount (ETH): **${this.autoBuySettings.buyAmount} ETH**

						Minimum Liquidity: **${ethers.utils.formatEther(this.autoBuySettings.minimumLiquidity)} ETH**
						Maximum Buy Tax: **${this.autoBuySettings.maximumBuyTax}%**
						Maximum Sell Tax: **${this.autoBuySettings.maximumSellTax}%**

						Minimum Locked Liquidity (ETH): **${ethers.utils.formatEther(this.autoBuySettings.minimumLockedLiq)} ETH**

					`
					)
			],
			components: [
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('uc_req_ver').setLabel('Toggle Verified')
						.setStyle(this.autoBuySettings.requireVerified ? ButtonStyle.Secondary : ButtonStyle.Primary),

					new ButtonBuilder().setCustomId('uc_req_hp').setLabel('Toggle HP Check')
						.setStyle(this.autoBuySettings.requireHoneypotCheck ? ButtonStyle.Secondary : ButtonStyle.Primary),

					new ButtonBuilder().setCustomId('uc_req_liq').setLabel('Toggle Liquidity Lock')
						.setStyle(this.autoBuySettings.requireLiquidityLock ? ButtonStyle.Secondary : ButtonStyle.Primary),

					new ButtonBuilder().setCustomId('uc_allow_prev_contracts').setLabel('Toggle Prev. Contracts')
						.setStyle(this.autoBuySettings.allowPrevContracts ? ButtonStyle.Secondary : ButtonStyle.Primary),

				),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('uc_set_buy_amount').setLabel('Set Buy Amount')
					.setStyle(ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('uc_set_min_liq').setLabel('Set Min. Liquidity')
						.setStyle(ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('uc_set_btax').setLabel('Set Max. Buy Tax')
						.setStyle(ButtonStyle.Secondary).setDisabled(!this.autoBuySettings.requireHoneypotCheck),

					new ButtonBuilder().setCustomId('uc_set_stax').setLabel('Set Max. Sell Tax')
						.setStyle(ButtonStyle.Secondary).setDisabled(!this.autoBuySettings.requireHoneypotCheck),

				),
				new ActionRowBuilder().addComponents(
					// new ButtonBuilder().setCustomId('uc_set_tholder_threshold').setLabel('Set Top Holder Threshold').setStyle(ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('uc_set_lock_liquidity').setLabel('Set Locked Liquidity')
						.setStyle(ButtonStyle.Secondary).setDisabled(!this.autoBuySettings.requireLiquidityLock),
				)
			],
			ephemeral: true
		};

		if (update) {
			await interaction.update(content);
		} else {
			await interaction.reply(content);
		}
	}
	checkLiquidity(amount, tokenData, selling) {
		console.log("checkLiquidity amount=" + amount);
		console.log("checkLiquidity eth_liquidity=" + tokenData.eth_liquidity);
		console.log("checkLiquidity token_liquidity=" + tokenData.token_liquidity);
		if (selling) {
			if (amount.gt(tokenData.token_liquidity))
				throw `Token Pair(${tokenData.pair}) have not enough liquidity. \n
				Trading amount is ${ethers.utils.formatUnits(amount, tokenData.decimals)}${tokenData.symbol}. \n
				Token liquidity is ${ethers.utils.formatUnits(tokenData.token_liquidity, tokenData.decimals)}${tokenData.symbol} `;
		}
		else {
			if (amount.gt(tokenData.eth_liquidity))
				throw `Token Pair(${tokenData.pair}) have not enough liquidity. \n
			Trading amount is ${ethers.utils.formatEther(amount)}. \n
			Liquidity is ${ethers.utils.formatEther(tokenData.eth_liquidity)} `;
		}
	}
	async checkBalance(amount, tokenData, selling) {
		let _balance;
		if (selling) {
			_balance = await tokenData.ctx.balanceOf(this.account.address);
			if (_balance.lt(amount) || _balance.lte(0) || amount.lte(0)) {
				throw `Wallet(${this.account.address}) has not enough balance. \n
					Trading amount is ${ethers.utils.formatUnits(amount, tokenData.decimals)} ${tokenData.symbol}. \n
					Balance of your wallet is ${ethers.utils.formatUnits(_balance, tokenData.decimals)}${tokenData.symbol} `;
			}
		}
		else {
			_balance = await this.getBalance();
			if (_balance.lt(amount) || _balance.lte(0) || amount.lte(0)) {
				throw `Wallet(${this.account.address}) has not enough balance. \n
			Trading amount is ${ethers.utils.formatEther(amount)} eth. \n
			Balance is ${ethers.utils.formatEther(_balance)} eth. `;
			}
		}

	}

	async checkAllowance(amount, tokenData) {
		let _allowance = await tokenData.ctx.allowance(
			this.account.address,
			Network.asapswap.address
		);
		// not enough allowance: _allowance < _balance
		if (_allowance.lt(amount)) {
			let _nonce = await Network.node.getTransactionCount(this.account.address);
			let tx = null;
			try {
				const token_ctx = new ethers.Contract(
					tokenData.address,
					constants.TOKEN_ABI,
					this.account
				);

				tx = await token_ctx.approve(
					this.asapswap.address,
					(ethers.BigNumber.from("2").pow(ethers.BigNumber.from("256").sub(ethers.BigNumber.from("1")))).toString(),
					{
						'maxPriorityFeePerGas': this.config.maxPriorityFee || this.defaultConfig.maxPriorityFee,
						'gasLimit': constants.DEFAULT_GAS_LIMIT,
						'nonce': _nonce
					}
				);
				let response = await tx.wait();
				if (response.confirmations < 1) {
					console.log(`Could not approve transaction`);
					throw 'Could not approve transaction.';
				}

			}
			catch (err) {
				throw `Wallet(${this.account.address}) get failed while approve allowance on Token(${tokenData.address})` + err;
			}
		}
	}

	async estimateGas(tokendata, amount, selling, inviteCode, limit) {
		let functionGasFees = null;
		try {
			if (selling) {
				functionGasFees = await this.asapswap.estimateGas.SwapTokenToEth(amount, tokendata.address, tokendata.pair, inviteCode);
			} else {
				functionGasFees = await this.asapswap.estimateGas.SwapEthToToken(tokendata.address, tokendata.pair, inviteCode, { value: amount });
			}
			functionGasFees = functionGasFees.add(100000);
			if (Number(functionGasFees) < Number(limit))
				return functionGasFees;
			return limit;
			//throw {message:`Error:Estimated Gas fee(${functionGasFees}) is higher than limited (${limit}). Please try again ...`};
		}
		catch (err) {
			throw `Estimate Gas fee is failed. ` + err;
		}

	}
	async replyTxStatus(interaction, title, description) {
		await interaction.edit({
			embeds: [
				new EmbedBuilder()
					.setColor(0xffb800)
					.setTitle(title)
					.setDescription(
						description
					)
			]
		});
		console.log("processing status " + title + " desc:" + description);
	}
	async sendUserMsg(title, description) {
		return await this.discordUser.send({
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x0099FF)
					.setTitle(title)
					.setDescription(
						description
					)
			],
			components: []
		});
	}
	/**
	 * 
	 * @param {*} tokenAddress address 
	 * @param {*} tradeAmount if buy , this is ether amount, if sell, this is percentage of user balance.
	 * @param {*} gaslimit gas limitation, 
	 * 	if limit order,it is set as DefaultConfig.gaslimit. 
	 *  if manul sell/buy, it is set as user input gaslmit. If user don't input gas limit, it is set as DefaultConfig.gaslimit.
	 * @param {*} selling 
	 */
	async sendTransaction(tokenAddress, tradeAmount, gaslimit, selling, tradeSort) {
		let _amount;
		let _oldAmount;
		let interaction = await this.sendUserMsg("Transaction Started", `processsing token(${tokenAddress})...`);
		try {
			const tokenData = await Network.tokenManager.update(tokenAddress);
			if (!tokenData) throw (`Token(${tokenAddress}) is not valid.`);

			if (selling) {
				const _balance = await tokenData.ctx.balanceOf(this.account.address);
				_amount = _balance.mul(Number(tradeAmount) * 10000).div(1000000);
				_oldAmount = await this.getBalance();

			} else {
				_amount = ethers.utils.parseEther(tradeAmount);
				_oldAmount = await tokenData.ctx.balanceOf(this.account.address);
			}

			this.replyTxStatus(interaction, "Transaction Processing", `checking balance...`);
			await this.checkBalance(_amount, tokenData, selling);

			this.replyTxStatus(interaction, "Transaction Processing", `checking liquidity...`);
			this.checkLiquidity(_amount, tokenData, selling);

			if (selling) {
				await this.replyTxStatus(interaction, "Transaction Processing", `checking allowance...`);
				await this.checkAllowance(_amount, tokenData);
			}
			const inviteCode = await this.getReferrerCode();
			this.replyTxStatus(interaction, "Transaction Processing", `estimating gasfee...`);
			const gasLimit = await this.estimateGas(tokenData, _amount, selling, inviteCode, gaslimit);

			this.replyTxStatus(interaction, "Transaction Processing", `sending transaction... \n
			token : ${tokenAddress} \n
			pair : ${tokenData.pair}\n
			Trading Amount : ${_amount}\n
			InviteCode : ${inviteCode}\n
			GasLimit : ${gasLimit}`);

			const transaction = await (selling ?
				this.submitSellTransaction(tokenAddress, tokenData.pair, _amount, inviteCode, gasLimit) :
				this.submitBuyTransaction(tokenAddress, tokenData.pair, _amount, inviteCode, gasLimit));
			this.replyTxStatus(interaction, "Transaction Processing", `Waiting for Tx = ${transaction.hash}`);
			let response = await Network.node.waitForTransaction(transaction.hash);

			if (response.status != 1) {
				throw `Transaction failed with status: ${response.status}.`;
			}

			if (response.confirmations == 0) {
				throw `The transaction could not be confirmed in time.`;
			}

			// Save trade history to DB
			const tradeMode = selling ? constants.TRADE_MODE.SELL : constants.TRADE_MODE.BUY;
			const tradeResult = await this.getTradeResult(
				tokenData,
				tradeMode,
				_oldAmount
			);
									
			const tradeAt = new Date();
			const registerd = await registerHistory(
				this.discordId,
				this.account.address,
				tradeMode,
				tokenAddress,
				_amount.toString(),
				transaction.hash,
				tokenData.price.toString(),
				tradeAt,
				tokenData.symbol,
				tokenData.decimals,
				tradeResult,
				tradeSort
			);
																		
			// Show trade history on trading history channel
			await this.showTradeHistory(
				this.discordId,
				this.account.address,
				tradeMode,
				tokenAddress,
				_amount,
				transaction.hash,
				tokenData.price,
				tradeAt,
				tokenData.symbol,
				tokenData.decimals,
				tradeSort
			);
									
			if (selling) {
				await this.showSellingPNLData(tokenData, _amount, tradeResult, tradeAt, registerd);
			}

			this.replyTxStatus(interaction, "Transaction Finished", `Transaction succeed. Tx = ${transaction.hash}`);
			return transaction.hash;
		}
		catch (e) {
			this.replyTxStatus(interaction, "Transaction failed", `Transaction for token(${tokenAddress}) get failed. \b Error : ` + e);
			throw (e);
		}

	}


	async submitBuyTransaction(token, pair, amount, inviteCode, gaslimit) {


		let tx = null;

		tx = await this.account.sendTransaction({
			from: this.account.address,
			to: this.asapswap.address,

			data: this.asapswap.interface.encodeFunctionData(
				'SwapEthToToken',
				[
					token,
					pair,
					inviteCode
				]
			),

			value: amount,
			maxPriorityFeePerGas: this.config.maxPriorityFee || this.defaultConfig.maxPriorityFee,
			gasLimit: gaslimit
		});

		return tx;
	}

	async submitSellTransaction(token, pair, amount, inviteCode, gaslimit) {

		let tx = null;

		tx = await this.account.sendTransaction({
			from: this.account.address,
			to: this.asapswap.address,

			data: this.asapswap.interface.encodeFunctionData(
				'SwapTokenToEth',
				[
					amount,
					token,
					pair,
					inviteCode
				]
			),
			maxPriorityFeePerGas: this.config.maxPriorityFee || this.defaultConfig.maxPriorityFee,
			gasLimit: gaslimit
		});

		console.log("tx in SwapTokenToEth: " + tx?.hash)


		return tx;

	}

	async getBalance() {
		return await this.account.getBalance();
	}

	async computeOptimalGas() {
		let gas = await Network.node.getFeeData();
		let baseFeePerGas = gas.lastBaseFeePerGas;
		let maxFeePergas = (baseFeePerGas.mul(2).add(this.config.maxPriorityFee || this.defaultConfig.maxPriorityFee));

		return maxFeePergas;
	}

	isConfigCompleted() {
		if (this.autoBuySettings.buyAmount)
			return true;

		return false;
	}

	getConfig() {
		return this.config;
	}

	async sendOrderBuyTransaction(tokenData, amount, orderId) {

		let _balance = ethers.utils.parseUnits(`${amount}`, 18) || 0;
		// TO:DO check if user has enough balance.
		let bal = await this.getBalance();
		if (bal.lt(_balance)) {
			throw `Not enough balance. Limit order amount is ${amount} Eth. Your balance is ${ethers.utils.formatEther(bal)} Eth`;
		}

		// submit real tx
		const transaction = await this.submitBuyTransaction(tokenData.address, tokenData.pair, _balance, inviteCode, _gasLimit);
		console.log("response transaction hash is: " + transaction.hash);

		// wait for response
		let response = await Network.node.waitForTransaction(transaction.hash);
		console.log("response status is : " + response.status);

		if (response.status != 1) {
			throw `Transaction failed with status: ${response.status}.`;
		}

		if (response.confirmations == 0) {
			throw `The transaction could not be confirmed in time.`;
		}

		await Network.orderMnager.closeOrder(orderId, constants.ORDER_STATUS.SUCCESS, transaction.hash);

		return transaction.hash;
	}

	async changeUserWallet(newAddress, inviteCode) {
		console.log(`ChangeUserWallet start the wallet address: ${this.account.address}`);
		try {
			let gas_limit = await this.asapswap.estimateGas.changeUserWallet(newAddress, inviteCode);
			gas_limit = gas_limit.add(100000);

			const tx = await this.account.sendTransaction({
				from: this.account.address,
				to: Network.asapswap.address,

				data: this.asapswap.interface.encodeFunctionData(
					'changeUserWallet',
					[
						newAddress,
						inviteCode
					]
				),
				maxPriorityFeePerGas: this.config.maxPriorityFee || this.defaultConfig.maxPriorityFee,
				gasLimit: gas_limit
			});

			if (tx?.hash) {
				return true;
			}
		}
		catch (err) {
			console.log("Error in changeUserWallet: " + err);
			throw `Change your default wallet(${this.account.address}) as new wallet(${newAddress}) on contract get failed\n ` + (err.message ? err.message : err);
		}

		return false;
	}

	async getReferrerCode() {
		const userData = await getUserInfo(this.discordId);
		if (userData && userData?.inviter) {
			const inviterdData = await getUserInfo(userData?.inviter);
			if (inviterdData && inviterdData?.inviteCode) {
				return inviterdData?.inviteCode;
			}
		}

		return `0x0000000000000000`;
	}
	async showClaimableAmount(interaction) {

		const userInfo = await getUserInfo(this.discordId);
		await interaction.reply({ content: `We are checking your invite code...`, ephemeral: true, fetchReply: true });
		let inviteCode = userInfo?.inviteCode;
		if (!userInfo?.inviteCode) {
			await interaction.editReply({ content: `You seems loss your invite code. We are trying to get your invite code from smart conctract ...`, ephemeral: true });
			const oldRefferCode = await this.getReferrerCodeFromContract();

			if (oldRefferCode == `` || oldRefferCode.startsWith(`0x0000`)) {
				await interaction.editReply({
					content: `Sorry! There is no invite code registerd in contract for you.\n
				Discord ID : ${this.discordId} \n
				Wallet Address : ${this.account.address}`, ephemeral: true
				});
				return;
			}
			inviteCode = oldRefferCode;
		}
		console.log(`User(${this.discordId})'s invite code is ${inviteCode} `);
		await interaction.editReply({ content: `I'm getting your claimable amount for invite code(${inviteCode})`, ephemeral: true, fetchReply: true });
		try {
			const claimAmount = await this.asapswap.getClaimableAmount(inviteCode);

			const msg = `Your claimable amount is ${claimAmount.toString()}`;
			await interaction.editReply({ content: msg, ephemeral: true });
		}
		catch (err) {
			console.log("Error in get claimable amount: " + err);
			const msg = `Your current wallet have no balance to claim. \n Your invite code is ${inviteCode}. \n If you have any problems, please contact the Admin.`;
			await interaction.editReply({ content: msg, ephemeral: true });
			//await interaction.editReply({ content: `I get failed when read claimable amount. Error : ` + err, ephemeral: true });
		}
	}
	async claimInviteRewards(interaction) {
		await interaction.reply({ content: `Check claiming rewards requirements ...`, ephemeral: true, fetchReply: true });

		let msg = `Claim invite rewards gets failed. Plase try again!`;

		const userInfo = await getUserInfo(this.discordId);

		if (userInfo?.joiners?.length < process.env.CLAIM_REWARD_MINIUM_JOINER) {
			await interaction.editReply({ content: `You can only claim the rewards after ${process.env.CLAIM_REWARD_MINIUM_JOINER} users joined with your link`, ephemeral: true });
			return;
		}

		if (!userInfo?.inviteCode) {
			await interaction.editReply({ content: `You seems loss your invite code. We are trying to get your invite code from smart conctract ...`, ephemeral: true });
			const oldRefferCode = await this.getReferrerCodeFromContract();

			if (oldRefferCode == `` || oldRefferCode.startsWith(`0x0000`)) {
				await interaction.editReply({
					content: `Sorry! There is no invite code registerd in contract for you.\n
				Discord ID : ${this.discordId} \n
				Wallet Address : ${this.account.address}`, ephemeral: true
				});
				return;
			}
		}
		const _balance = await this.getBalance();
		if (_balance.lt(1000000000000000)) {
			return await interaction.editReply({ content: `Wallet(${this.account.address}) has not enough balance to do claim transaction. \nBalance : ${ethers.utils.formatEther(_balance)}Eth`, ephemeral: true });
		}
		try {
			const tx = await this.account.sendTransaction({
				from: this.account.address,
				to: Network.asapswap.address,

				data: this.asapswap.interface.encodeFunctionData(
					'ClaimReferrerProfit',
					[
						userInfo?.inviteCode
					]
				),
				maxPriorityFeePerGas: this.config.maxPriorityFee || this.defaultConfig.maxPriorityFee,
				gasLimit: `${constants.DEFAULT_GAS_LIMIT}`
			});

			console.log(`ClaimReferrerProfit tx hash is: ${tx?.hash}`);
			if (tx?.hash) {
				let response = await Network.node.waitForTransaction(tx.hash);

				if (response.status != 1) {
					throw `Transaction failed with status: ${response.status}.`;
				}

				if (response.confirmations == 0) {
					throw `The transaction could not be confirmed in time.`;
				}
				msg = `You have claimed the invite rewards. Please check your wallet.`
			}
			await interaction.editReply({ content: msg, ephemeral: true });
		}
		catch (err) {
			console.log("Error in claimInviteRewards: " + err);
			await interaction.editReply({ content: `Claiming referral fee get failed ` + err, ephemeral: true });
		}


	}

	async generateReferralCode(interaction) {
		try {
			const oldRefferCode = await this.getReferrerCodeFromContract();
			if (oldRefferCode && !oldRefferCode.startsWith(`0x0000000000`)) {
				console.log(`User(${this.discordId} have already refferal code (${oldRefferCode}) on Contract `);
				await interaction.editReply({ content: `This user(${this.username} have already refferal code (${oldRefferCode}) on Contract `, ephemeral: true });
				return oldRefferCode;
			}


			const tx = await this.account.sendTransaction({
				from: this.account.address,
				to: Network.asapswap.address,

				data: this.asapswap.interface.encodeFunctionData(
					'generateReferralCode',
					[
						this.discordId
					]
				),
				maxPriorityFeePerGas: this.config.maxPriorityFee || this.defaultConfig.maxPriorityFee,
				gasLimit: `${constants.DEFAULT_GAS_LIMIT}`
			});
			if (tx?.hash) {
				const response = await tx.wait();

				const returnValue = this.asapswap.interface.parseLog(response.logs[0]);

				return returnValue?.args[1];
			}

		}
		catch (err) {
			await interaction.editReply({ content: `This user(${this.username} get failed when generate referral code from contract. ` + err.message, ephemeral: true });
			console.log(`User(${this.discordId} get failed when generate referral code from contract ` + err);
		}

		return ``;
	}

	async getReferrerCodeFromContract() {
		try {
			const referrerCode = await this.asapswap.getReferralCode(this.discordId);
			return referrerCode;
		}
		catch (err) {
			console.log("error in getReferrerCodeFromContract: " + err);
		}

		return ``;
	}

	async getCurTokenPrice(tokenAddress, amount, isBuy) {

		const tokenData = await Network.tokenManager.update(tokenAddress);

		return tokenData.price;
	}

	async getBalanceOf(tokenAddress) {
		let _balance = null;

		try {
			const ctx = new ethers.Contract(
				tokenAddress,
				constants.TOKEN_ABI,
				this.account
			);

			_balance = await ctx.balanceOf(this.account.address);
		}
		catch (err) {
			console.log(`Error in get balance of token(${tokenAddress}): ` + err);
		}

		return _balance;
	}

	async showTradeHistory(
		discordId,
		walletAddress,
		tradeMode,
		tokenAddress,
		tradeAmount,
		transaction,
		tradePrice,
		tradeAt,
		symbol,
		decimals,
		tradeSort
	) {

		try {
			const parsedTradeAmount = ethers.utils.formatUnits(tradeAmount, decimals);

			const interaction = await Network.channel_trading_history.send({
				content: `Trading`,
				embeds: [
					new EmbedBuilder()
						.setColor(0x000000)
						.setTitle(`${symbol}/WETH`)
						.setDescription(symbol + "\n" + tokenAddress)
						.addFields(
							{
								name: 'Trade Date',
								value: `<t:${Math.round(tradeAt.getTime() / 1000)}:R>`,
								inline: false
							}
						)
						.addFields(
							{
								name: 'Trade Mode',
								value: tradeMode == constants.TRADE_MODE.SELL ? `SELL` : `BUY`,
								inline: false
							}
						)
						.addFields(
							{
								name: 'User Wallet Address',
								value: `[${Helpers.dotdot(walletAddress)}](https://etherscan.io/address/${walletAddress})`,
								inline: false
							}
						)
						.addFields(
							{
								name: 'Trade Amount',
								value: `${parsedTradeAmount} ${tradeMode === constants.TRADE_MODE.BUY ? 'ETH' : ''}`,
								inline: false
							}
						)
						.addFields(
							{
								name: 'Trade Sort',
								value: `${tradeSort}`,
								inline: false
							}
						)
						.addFields(
							{ name: 'Transaction', value: `[LP Etherscan](https://etherscan.io/tx/${transaction})` }
						)
						.setURL(`https://etherscan.io/address/${tokenAddress}`)
				],
				components: [

				],
				allowedMentions: { parse: [] }
			});
		}
		catch (err) {
			console.log(`Error is occurred when show trade history on Trade History Channel: ${err}`);
		}
	}

	async calculatePNL(tokenData, getEthAmount, sellingTokenNum, tradeAt) {
		const trades= await getTradeInfo(this.discordId, tokenData.address);
		let boughtTokenNum = ethers.utils.parseUnits(`0`, tokenData.decimals);
		let paidEth = ethers.utils.parseUnits(`0`, 18);
		let soldTokenNum = ethers.utils.parseUnits(`0`, tokenData.decimals);

		let boughtFullTokenNum =ethers.utils.parseUnits(`0`, tokenData.decimals);
		let paidFullEth = ethers.utils.parseUnits(`0`, 18);


		let pnlAmount = ethers.utils.parseUnits(`0`, tokenData.decimals), pnlPercentage = 0;

		try {
			for (let i = 0; i < trades.length; i++) {
				if(trades[i].tradeMode == constants.TRADE_MODE.SELL)
				{
					soldTokenNum = soldTokenNum.add(ethers.BigNumber.from(trades[i].tradeAmount));
				}
				else
				{
					paidFullEth = paidFullEth.add(ethers.BigNumber.from(trades[i].tradeAmount));
					boughtFullTokenNum = boughtFullTokenNum.add(ethers.BigNumber.from(trades[i].tradeResult));
	
					if(soldTokenNum.gt(ethers.BigNumber.from(trades[i].tradeResult)))
					{
						soldTokenNum = soldTokenNum.sub(ethers.BigNumber.from(trades[i].tradeResult));
					}
					else{
						boughtTokenNum = boughtTokenNum.add(
							ethers.BigNumber.from(trades[i].tradeResult).sub(soldTokenNum)
						);
						// paidEth += (trades[i].tradeResult -  soldTokenNum)* trades[i].tradePrice;
						soldTokenNum = ethers.utils.parseUnits(`0`, tokenData.decimals);
					}
				}
				
				if (boughtTokenNum.gte(sellingTokenNum)) {
					// paidEth = paidEth - (boughtTokenNum - sellingTokenNum) * trades[i].tradePrice;
					boughtTokenNum = sellingTokenNum;
					break;
				}
			}
	
			let formattedBoughtTokenNum = `0`;
			if(boughtTokenNum.gt(0)) {
				const formattedBoughtFullTokenNum = ethers.utils.formatUnits(boughtFullTokenNum, tokenData.decimals);
				formattedBoughtTokenNum = ethers.utils.formatUnits(boughtTokenNum, tokenData.decimals);
				paidEth = paidFullEth.div(Math.ceil(parseFloat(Number(formattedBoughtFullTokenNum)))).mul(Math.ceil(parseFloat(Number(formattedBoughtTokenNum)))); //!!!
			}
			else {
				return {
					pnlAmount: parseFloat(Number(ethers.utils.formatUnits(getEthAmount, 18))).toFixed(9),
					pnlPercentage: Infinity,
					paidEth: paidEth,
					formattedBoughtTokenNum
				}
			}

			if(boughtTokenNum.lt(sellingTokenNum))
			{
				const formattedSellingTokenNum = ethers.utils.formatUnits(sellingTokenNum, tokenData.decimals);
				formattedBoughtTokenNum = ethers.utils.formatUnits(boughtTokenNum, tokenData.decimals);
				const profitAmount = getEthAmount.div(Math.ceil(parseFloat(Number(formattedSellingTokenNum)))).mul(Math.ceil(parseFloat(Number(formattedBoughtTokenNum)))); //!!!
				// user is trying to sell tokens which user buy using another platform
				pnlAmount = profitAmount.sub(paidEth); //!!!
			}
			else{
				pnlAmount = getEthAmount.sub(paidEth); //!!!
			}
	
			pnlAmount = ethers.utils.formatUnits(pnlAmount, 18);
			// paidEth = ethers.utils.formatUnits(paidEth, 18);
			pnlPercentage = (pnlAmount / paidEth) * 100; //!!!
	
			// consider cur price is undefined
			return {
				pnlAmount: parseFloat(Number(pnlAmount)).toFixed(9),
				pnlPercentage: `${Math.round(pnlPercentage)}`,
				paidEth,
				formattedBoughtTokenNum
			}
		}
		catch(err) {
			throw new Error(`Can not calculate the PNL of token: ${tokenData.address} with error: ${err}`);
		}
	}

	async showSellingPNLData(tokenData, tradeAmount, tradeResult, tradeAt, tradeData) {
		try {
			const pnlInfo = await this.calculatePNL(tokenData, tradeResult, tradeAmount, tradeAt);
			const userData = await getUserInfo(this.discordId);
			// if(pnlInfo?.pnlPercentage == Infinity) {
			// 	return;
			// }

			await this.sendPNL(tokenData, pnlInfo?.pnlPercentage, {tokenValue:pnlInfo?.paidEth, tokenNumber:  pnlInfo.formattedBoughtTokenNum}, tradeData, userData.referralLink, Network.channel_trading_history);
		}
		catch (err) {
			console.log(`Couldn't show PNL data for ${tokenData.address} with error: ${err}`);
		}
	}

	async showTradePNL(interaction, txHash, isAdmin = false) {
		try {
			await interaction.reply({ content: `Getting PNL image from trade ${txHash}`, ephemeral: true, fetchReply: true });

			const tradeData = await getTradeInfoByTx(txHash);

			if(!isAdmin && tradeData?.discordId != this.discordId) {
				await interaction.editReply({ content: `This trade is not that you performed!`, ephemeral: true, fetchReply: true });
				return;
			}

			const tokenData = await Network.tokenManager.update(tradeData?.tokenAddress);
			const userData =  await getUserInfo(this.discordId);
			if(tradeData) {
				let tradingData = {
					tokenValue: ethers.utils.parseUnits(`0`, 18),
					tokenNumber: `0`,
				}
				const priceChangeRate = await this.calcPriceChangeRate(
					ethers.BigNumber.from(`${tradeData?.tradePrice}`),
					tokenData.price
				);
				if(tradeData?.tradeMode == constants.TRADE_MODE.BUY) {
					tradingData.tokenValue = ethers.BigNumber.from(tradeData?.tradeAmount);
					tradingData.tokenNumber = ethers.utils.formatUnits(ethers.BigNumber.from(tradeData?.tradeResult), tokenData.decimals);
				}
				else {
					tradingData.tokenValue = ethers.BigNumber.from(tradeData?.tradeResult);
					tradingData.tokenNumber = ethers.utils.formatUnits(ethers.BigNumber.from(tradeData?.tradeAmount), tokenData.decimals);
				}
				
				await this.sendPNL(tokenData, priceChangeRate, tradingData, tradeData, userData.referralLink, null, interaction, isAdmin);
				return;
			}
			else {
				await interaction.reply({ content: `Trade info does not exist on ${txHash}`, ephemeral: true, fetchReply: true });

				return;
			}

		}
		catch(err) {
			console.log(`Getting Trade PNL Data failed with error: ${err}`);
			await interaction.editReply({ content: `Could not get PNL info from ${txHash}`, ephemeral: true, fetchReply: true });

			return;
		}
	}

	async sendPNL(tokenData, pnlPercentage, entryValue, tradeData, referralLink, channel = null, interaction = null, isAdmin = false) {
		try{
			// Define the canvas
			const canvas = createCanvas(canvasWidth, canvasHeight);
			const ctx = canvas.getContext('2d');
			const currentToken = await this.getCurTokenValueForETH(tokenData);

			// Draw Background Image
			const pnlSortData = this.getPNLSort(pnlPercentage);
			const imagePath = path.join(__dirname, `./../assets/images/pnls/${pnlSortData.background}`);
			const backgroundImage = await loadImage(imagePath);
			ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
			let reffer_link = constants.PNL_DEFAUT_LINK;
			if (referralLink) {
				reffer_link = referralLink;
			}
			{
				// Draw QRCode Image
				const qrCode = await QRCode.toDataURL(reffer_link);
				const qrCodeImage = await loadImage(qrCode);
				ctx.drawImage(qrCodeImage, 50, 330, 70, 70);

				// Draw the InviteCode Title
				ctx.font = 'bold 18px sans-serif';
				ctx.fillStyle = '#808080';
				ctx.fillText(`Refer and earn 20% swap fee`, 136, 362);
				// Draw the InviteCode Code
				ctx.font = '16px sans-serif';
				ctx.fillStyle = '#808080';
				ctx.fillText(`${reffer_link}`, 136, 380);
			}

			// Draw the Token Symbol
			ctx.fillStyle = '#808080';
			ctx.font = 'bold 20px sans-serif';
			ctx.fillText(`${tokenData.symbol} / WETH`, 50, 140);

			// Draw the PNL Percentage
			ctx.fillStyle = `${pnlPercentage >= 0 ? '#fcba03' : '#ff0000'}`;
			ctx.font = '54px sans-serif';
			ctx.fillText(
				`${ pnlPercentage == Infinity ? `N/A` : (pnlPercentage >= 0 ? '+' : '')} ${pnlPercentage == Infinity ? `` : pnlPercentage + '%'}
				`,
				50,
				242
			);

			// Draw the Etnry Price
			ctx.fillStyle = '#FFFFFF';
			ctx.font = '16px sans-serif';
			ctx.fillText(`Entry Price`, 290, 202);
			ctx.fillStyle = '#808080';
			ctx.font = '16px sans-serif';
			console.log(`1`);
			ctx.fillText(
				`${Helpers.convertWeiToScriptEth(ethers.BigNumber.from(`${tradeData.tradePrice}`))} ETH`, 
				316, 
				220
			);

			// Draw the Current Price
			ctx.fillStyle = '#FFFFFF';
			ctx.font = '16px sans-serif';
			ctx.fillText(`Current Price`, 290, 240);
			ctx.fillStyle = '#808080';
			ctx.font = '16px sans-serif';
			console.log(`2`);
			ctx.fillText(
				`${Helpers.convertWeiToScriptEth(tokenData.price)} ETH`, 
				316, 
				258
			);
			
			let entryText = `Entry Value`;
			if (!channel) {
				entryText = `Sold Value`;

				if(tradeData.tradeMode == constants.TRADE_MODE.BUY) {
					entryText = `Bought Value`;
				}
			}

			// Draw the Etnry Value
			ctx.fillStyle = '#fcba03';
			ctx.font = '18px sans-serif';
			ctx.fillText(entryText, 50, 296);
			ctx.fillStyle = '#FFFFFF';
			ctx.font = '18px sans-serif';
			console.log(`3`);
			ctx.fillText(`${Helpers.convertWeiToScriptEth(entryValue.tokenValue)} ETH / ${Helpers.toFixedNumber(entryValue.tokenNumber, 3)}`, 186, 296);

			// Draw the Current Price
			ctx.fillStyle = '#fcba03';
			ctx.font = '18px sans-serif';
			ctx.fillText('Current Value', 50, 316);
			ctx.fillStyle = '#FFFFFF';
			ctx.font = '18px sans-serif';
			console.log(`4`);
			ctx.fillText(`${Helpers.convertWeiToScriptEth(currentToken.tokenValue)} ETH / ${Helpers.toFixedNumber(currentToken.tokenNumber, 3)}`, 186, 316);
			console.log(`5`);
			const buffer = canvas.toBuffer('image/png');
			const attachment = new AttachmentBuilder(buffer, 'image.png');

			const dirPath = './pnl_shares';

			if(!isAdmin) {
				if (!fs.existsSync(dirPath)) {
					fs.mkdir(dirPath, (err) => {
						if (err) {
							console.error(err);
						}
						else {
							fs.writeFileSync(`./pnl_shares/${tradeData?._id?.toString()}.png`, attachment.attachment, (err) => {
								if (err) {
									console.error(`Saving PNL image failed: ${err}`);
								} else {
									console.log('File saved successfully');
								}
							});
						}
					});
				}
				else {
					fs.writeFileSync(`./pnl_shares/${tradeData?._id?.toString()}.png`, attachment.attachment, (err) => {
						if (err) {
							console.error(`Saving PNL image failed: ${err}`);
						} else {
							console.log('File saved successfully');
						}
					});
				}

				if(channel) {
					const payload = new MessagePayload(channel, { files: [attachment] });
	
					await channel.send(
						payload
					);
					await this.discordUser.send(payload);
				}
				else {
					const payload = new MessagePayload(Network.channel_trading_history, { files: [attachment] });
					await interaction.editReply(payload);
					await this.discordUser.send(payload);
				}
			}
			else {
				const payload = new MessagePayload(Network.admin_channel, { files: [attachment] });
				await interaction.editReply(payload);
			}

		}
		catch(err){
			console.log(`Couldn't send PNL data for ${tokenData.address} with error: ${err}`);
			if(!channel) {
				await interaction.editReply({ content: `Getting PNL Image Failed from trade ${txHash}`, ephemeral: true });
			}
			
		}
	}

	getInviteCodeFromUrl(inviteUrl) {
		try {
			const codes = inviteUrl.match(/discord\.gg\/(.+)/)[1];
			return codes.split("#")[0];
		}
		catch (err) {
			console.log(`Couldn't extract invite code from ${inviteUrl} with error: ${err}`);
		}

		return ``;
	}

	async getTradeResult(tokenData, mode, oldAmount) {
		try {
			if(mode === constants.TRADE_MODE.BUY) {
				const currentTokenAmount = await tokenData.ctx.balanceOf(this.account.address);
				return currentTokenAmount.sub(oldAmount);
			}
			else {
				const currentETHAmount = await this.getBalance();
				return currentETHAmount.sub(oldAmount);
			}
		}
		catch(err) {
			console.log(`Couldn't get Trade result in token(${tokenData.address}) with error: ${err}`);
		}

		return mode === constants.TRADE_MODE.BUY ? ethers.utils.parseUnits(`0`, tokenData.decimals) : ethers.utils.parseUnits(`0`, 18);
	}

	getPNLSort(pnlPercentage) {
		if(pnlPercentage >= constants.PNL_SORT.giga.value) {
			return constants.PNL_SORT.giga;
		}

		if(pnlPercentage >= constants.PNL_SORT.chad.value) {
			return constants.PNL_SORT.giga;
		}

		return constants.PNL_SORT.jeet;
	}

	async getCurTokenValueForETH (tokenData) {
		try {
			let currentTokenAmount = await tokenData.ctx.balanceOf(this.account.address);
			
			return {
				tokenValue: ethers.BigNumber.from(
					`${
						Math.round(
							parseFloat(
								Number(
									ethers.utils.formatUnits(
										(tokenData.price).mul(currentTokenAmount), 
										tokenData.decimals
									)
								)
							)
						)
					}`
				),
				tokenNumber: ethers.utils.formatUnits(currentTokenAmount, tokenData.decimals)
			}
		}
		catch(err) {
			console.log(`Get Token Value Failed with error: ${err}`);
		}

		return {
			tokenValue: ethers.utils.parseUnits(`0`, 18),
			tokenNumber: `0`
		}

		return ethers.utils.parseUnits(`0`, 18);
	}

	async calcPriceChangeRate (tradePrice, curPrice) {
		try {
			const formattedTradePrice = ethers.utils.formatUnits(tradePrice, 18);
			const formattedCurPrice = ethers.utils.formatUnits(curPrice, 18);

			return Math.round(((formattedCurPrice - formattedTradePrice) / formattedTradePrice) * 100);
		}
		catch(err) {
			console.log(`Get Token price change rate failed with error: ${err}`);
		}

		return 0;
	}
}

module.exports = ASAPUser;