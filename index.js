const ethers = require('ethers');
const fs = require('node:fs');
const path = require('node:path');

const Cryptr = require('cryptr');

const mongoose = require('mongoose');

const { getTokenInfoByInteraction, saveTokenInfoByInteraction } = require("./services/interactionService");
const { setReferralLink, increaseReferralCount, getCreator, getUserInfo, upsertAccountData, getAllAccounts } = require("./services/accountService");
const { fetchSniperData, upsertSniperData } = require("./services/tokenSniperService");
const { getTradeHistory, fetchTradeData, getTradeInfoByTx } = require('./services/tradehistoryService');
const { ASAPUser, UserCollection, Helpers, Network } = require('./libs/main.js');
const constants = require('./libs/constants.js');
require('dotenv').config()
const {
	Client,
	Collection,
	ButtonStyle,
	ButtonBuilder,
	SelectMenuBuilder,
	EmbedBuilder,
	Events,
	InteractionType,
	Invite,
	ChannelType,
	PermissionsBitField,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	GatewayIntentBits,
	GatewayDispatchEvents,
	ActivityType
} = require('discord.js');

let originalLog = console.log;
const etherscan = new (require('./libs/etherscan'))();

console.log = function (msg) {
	const time = new Date();
	let date = new Date();

	let hours = "", minutes = "", seconds = "";

	if (date.getHours() < 10)
		hours = "0" + date.getHours();
	else
		hours = date.getHours();

	if (date.getMinutes() < 10)
		minutes = "0" + date.getMinutes();
	else
		minutes = date.getMinutes();

	if (date.getSeconds() < 10)
		seconds = "0" + date.getSeconds();
	else
		seconds = date.getSeconds();

	const curtime = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + hours + ":" + minutes + ":" + seconds;
	const log_file = "./Logs/ASAPLog_" + date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + ".log";
	if (fs.existsSync(log_file)) {
		fs.appendFile(log_file, `[${curtime}] ${msg}\n`, err => {
			if (err) throw err;
		});
	} else {
		const dirPath = './Logs';

		if (!fs.existsSync(dirPath)) {
			fs.mkdir(dirPath, (err) => {
				if (err) {
					console.error(err);
				}
			});
		}
		fs.writeFile(log_file, `[${curtime}] ${msg}\n`, function (err) {
			if (err) throw err;
		});

	}
	return originalLog(`[${curtime}] ${msg}`);
}

function getFormattedDate() {
	let date = new Date();

	let hours = "", minutes = "", seconds = "";

	if (date.getHours() < 10)
		hours = "0" + date.getHours();
	else
		hours = date.getHours();

	if (date.getMinutes() < 10)
		minutes = "0" + date.getMinutes();
	else
		minutes = date.getMinutes();

	if (date.getSeconds() < 10)
		seconds = "0" + date.getSeconds();
	else
		seconds = date.getSeconds();

	let str = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + hours + ":" + minutes + ":" + seconds;

	return str;
}
async function initUsers(discordClient) {
	console.log("Initializing User List from DB....");

	const usersAndSnipers = await Promise.all([
		getAllAccounts(),
		fetchSniperData()
	]);

	const allRegisteredUsers = usersAndSnipers[0];
	const snipers = usersAndSnipers[1];

	await Promise.all(allRegisteredUsers.map(async asap_user => {
		UserCollection.add(
			asap_user.discordId,
			new ASAPUser(asap_user.discordId, asap_user.discordName)
		);
		const new_user = UserCollection.get(asap_user.discordId);
		await new_user.init();

		const snipeDataOfUser = snipers.find((sniper) => {
			return sniper.discordId === new_user.discordId;
		});

		if(snipeDataOfUser) {
			new_user.autoBuySettings = {
				autoBuying: false,
				requireVerified: snipeDataOfUser.requireVerified,
				requireHoneypotCheck: snipeDataOfUser.requireHoneypotCheck,
				requireLiquidityLock: snipeDataOfUser.requireLiquidityLock,
				allowPrevContracts: snipeDataOfUser.allowPrevContracts,

				buyAmount: snipeDataOfUser.buyAmount,
	
				minimumLockedLiq: ethers.BigNumber.from(snipeDataOfUser.minimumLockedLiq),
				topHolderThreshold: snipeDataOfUser.topHolderThreshold,
	
				minimumLiquidity: ethers.BigNumber.from(snipeDataOfUser.minimumLiquidity),
	
				maximumBuyTax: snipeDataOfUser.maximumBuyTax,
				maximumSellTax: snipeDataOfUser.maximumSellTax,
			}
		}

		if (new_user.userInfo.referralLink && new_user.userInfo.inviteCode) {
			// Extract the invite code from the link using a regular expression
			const codes = new_user.userInfo.referralLink.match(/discord\.gg\/(.+)/)[1];
			const inviteCode = codes.split("#")[0];
			discordClient.joinerCounter[inviteCode] = new_user.userInfo.joiners?.length;
		}
	}))
	console.log("User list is initialized...");
}
process.on('uncaughtException', (e, origin) => {

	let error = e.error ? e.error : e;

	console.log(`Exception: ${error}`);

	if (e.stack) {
		console.log(e.stack);
	}

});

// main wrapper
(async () => {

	mongoose.Promise = Promise;

	const mongoUri = process.env.MONGO_DB_URL;

	mongoose?.connect(mongoUri);
	mongoose?.connection.on('error', () => {
		console.log(`unable to connect to database: ${mongoUri}`);
		return;
	})
	mongoose?.connection.on('success', () => {
		console.log(`connected to database: ${mongoUri}`)
	})

	// load network
	await Network.load();


	// initialize client
	const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
	client.commands = new Collection();
	client.joinerCounter = {}
	Network.discordClient = client;

	// listen for commands
	client.on(Events.InteractionCreate, async (interaction) => {

		if (!UserCollection.exists(interaction.user.id)) {
			UserCollection.add(
				interaction.user.id,
				new ASAPUser(interaction.user.id, interaction.user.username)
			);
			const new_user = UserCollection.get(interaction.user.id);
			await new_user.init();
		}

		// fetch user
		let _user = UserCollection.get(interaction.user.id);

		if (interaction.isChatInputCommand()) {

			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(error);
				await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
			}

			return;

		}

		// interactions that don't care about auth (use return to stop code)
		if (interaction.isButton()) {

			switch (interaction.customId) {

				case 'setup': {

					await _user.showSettings(interaction);

					return;
				}

				case 'set_wallet': {

					const modal = new ModalBuilder()
						.setCustomId('set_wallet_key')
						.setTitle('Set Wallet')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('wallet-key').setLabel('Enter your wallet private key')
									.setStyle(TextInputStyle.Paragraph).setMinLength(64)
									.setPlaceholder('0x1234..')
									.setRequired(true),
							),
						]);

					await interaction.showModal(modal);

					return;
				}

				case 'setup_auto': {
					await _user.showAutoBuyFilters(interaction);

					return;
				}

				case 'uc_req_ver': {

					_user.autoBuySettings.requireVerified = !_user.autoBuySettings.requireVerified;
					await upsertSniperData(
						_user.discordId,
						{
							requireVerified: _user.autoBuySettings.requireVerified
						}
					);

					await _user.showAutoBuyFilters(interaction, true);

					return;
				}

				case 'uc_req_hp': {

					_user.autoBuySettings.requireHoneypotCheck = !_user.autoBuySettings.requireHoneypotCheck;
					await upsertSniperData(
						_user.discordId,
						{
							requireHoneypotCheck: _user.autoBuySettings.requireHoneypotCheck
						}
					);
					await _user.showAutoBuyFilters(interaction, true);

					return;
				}

				case 'uc_req_liq': {

					_user.autoBuySettings.requireLiquidityLock = !_user.autoBuySettings.requireLiquidityLock;
					await upsertSniperData(
						_user.discordId,
						{
							requireLiquidityLock: _user.autoBuySettings.requireLiquidityLock
						}
					);
					await _user.showAutoBuyFilters(interaction, true);

					return;
				}

				case 'uc_allow_prev_contracts': {

					_user.autoBuySettings.allowPrevContracts = !_user.autoBuySettings.allowPrevContracts;
					await upsertSniperData(
						_user.discordId,
						{
							allowPrevContracts: _user.autoBuySettings.allowPrevContracts
						}
					);
					await _user.showAutoBuyFilters(interaction, true);

					return;
				}

				case 'uc_set_btax': {

					const modal = new ModalBuilder()
						.setCustomId('set_btax')
						.setTitle('Set Max. Buy Tax')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('b-tax').setLabel('Max Buy Tax')
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMaxLength(3)
									.setValue(_user.autoBuySettings.maximumBuyTax)
									.setPlaceholder('A value between 0 and 100.'),
							),
						]);

					await interaction.showModal(modal);

					return;
				}

				case 'uc_set_stax': {

					const modal = new ModalBuilder()
						.setCustomId('set_stax')
						.setTitle('Set Max. Sell Tax')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('s-tax').setLabel('Max Sell Tax')
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMaxLength(3)
									.setValue(_user.autoBuySettings.maximumSellTax)
									.setPlaceholder('A value between 0 and 100.'),
							),
						]);

					await interaction.showModal(modal);

					return;
				}

				case 'uc_set_tholder_threshold': {

					const modal = new ModalBuilder()
						.setCustomId('set_tholder')
						.setTitle('Set Max Top Holder Threshold')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('holder_threshold').setLabel('Threshold')
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMaxLength(3)
									.setValue(_user.autoBuySettings.topHolderThreshold)
									.setPlaceholder('A value between 0 and 100.'),
							),
						]);

					await interaction.showModal(modal);

					return;
				}

				case 'uc_set_lock_liquidity': {

					const modal = new ModalBuilder()
						.setCustomId('set_lockedliq')
						.setTitle('Set Min. Locked Liquidity Percentage')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('locked_liq').setLabel('Min. Locked Liquidity')
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setValue(ethers.utils.formatEther(_user.autoBuySettings.minimumLockedLiq))
									.setPlaceholder('A value ETH value.'),
							),
						]);

					await interaction.showModal(modal);

					return;
				}

				case 'uc_set_min_liq': {

					const modal = new ModalBuilder()
						.setCustomId('set_min_liq')
						.setTitle('Set Min. Liquidity')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('min_liq').setLabel('Min. Liquidity In ETH')
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setValue(ethers.utils.formatEther(_user.autoBuySettings.minimumLiquidity))
									.setPlaceholder('A valid ETH value.'),
							),
						]);

					await interaction.showModal(modal);

					return;
				}

				case 'uc_set_buy_amount': {

					const modal = new ModalBuilder()
						.setCustomId('uc_set_buy_amount_modal')
						.setTitle('Set Buy Amount')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('uc_buy_amount').setLabel('Buy Amount In ETH')
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setValue(_user.autoBuySettings.buyAmount)
									.setPlaceholder('A valid ETH value.'),
							),
						]);

					await interaction.showModal(modal);

					return;
				}

				case 'create_wallet': {
					await interaction.reply({ content: 'Creating new wallet started...', ephemeral: true, fetchReply: true });
					let msg = `Wallet Creating is failed. Please try again!`;
					try {
						const userInfo = await getUserInfo(interaction.user.id);
						if (userInfo?.createdWalletNumber >= constants.MAX_CREATABLE_WALLET) {
							return await interaction.editReply({ content: 'You have reached the maximum number of wallets you can create.', ephemeral: true });
						}

						const wallet = ethers.Wallet.createRandom();

						if (wallet?.address) {

							let = res_before_change = {
								result: true,
								msg: ''
							}

							if (_user?.account?.address) {
								res_before_change = await _user.beforeChangeWallet(wallet.privateKey, interaction)
							}

							if (res_before_change?.result) {
								const res = await _user.setWallet(wallet.privateKey, true, interaction.user.username);

								if (res) {
									let cnt = userInfo?.createdWalletNumber;
									if (!userInfo?.createdWalletNumber) {
										cnt = 0
									}
									msg = `Private key is: ${wallet.privateKey}\nPublic Key is: ${wallet.address}`;
									await upsertAccountData(interaction.user.id, { createdWalletNumber: cnt + 1 });
								}
							}
							else {
								if (res_before_change?.msg) {
									msg = res_before_change?.msg;
								}
							}
						}
					}
					catch (err) {
						console.log(`Error when creating wallet: ${err}`)
					}
					await interaction.editReply({ content: msg, ephemeral: true });
					return;
				}

				case 'view_pnl': {
					const modal = new ModalBuilder()
					.setCustomId('view_pnl_modal')
					.setTitle('Add Trade Information')
					.addComponents([
						new ActionRowBuilder().addComponents(
							new TextInputBuilder()
							.setCustomId('tx_for_pnl')
							.setLabel('Transaction Hash')
							.setStyle(TextInputStyle.Paragraph)
							.setMaxLength(164)
							.setValue(``)
							.setPlaceholder('0x123')
							.setRequired(true),
						)
					]);

					await interaction.showModal(modal);
					return;
				}
			}

		} else if (interaction.isModalSubmit()) {

			switch (interaction.customId) {

				case 'set_wallet_key': {

					await interaction.reply({ content: 'Importing new wallet key...!', ephemeral: true, fetchReply: true });
					if (!_user.isValidPrivateKey(interaction.fields.getTextInputValue('wallet-key').trim())) {
						return await interaction.editReply({ content: 'Invalid private key specified.', ephemeral: true });
					}

					let = res_before_change = {
						result: true,
						msg: ''
					}

					if (_user?.account?.address) {
						res_before_change = await _user.beforeChangeWallet(interaction.fields.getTextInputValue('wallet-key').trim(), interaction)
					}


					if (res_before_change?.result) {
						const res = await _user.setWallet(interaction.fields.getTextInputValue('wallet-key').trim(), true, interaction.user.username);
						if (res) {
							// await _user.showSettings(interaction, true); //have to solve
							return await interaction.editReply({ content: `New wallet is imported! Address is ${_user.account.address}`, ephemeral: true });
						}
					}

					if (!res_before_change?.result && res_before_change?.msg) {
						return await interaction.editReply({ content: res_before_change?.msg, ephemeral: true });
					}

					return await interaction.editReply({ content: 'Wallet setting is failed. Plaese try again!', ephemeral: true });
				}

				case 'set_btax': {

					let tax = interaction.fields.getTextInputValue('b-tax');

					if (!Helpers.isInt(tax) || tax > 100 || tax < 1) {
						return interaction.reply({ content: 'Buy tax must be a valid number between 0 and 100.', ephemeral: true });
					}

					_user.autoBuySettings.maximumBuyTax = tax;
					await upsertSniperData(
						_user.discordId,
						{
							maximumBuyTax: _user.autoBuySettings.maximumBuyTax
						}
					);

					await _user.showAutoBuyFilters(interaction, true);

					return;
				}

				case 'set_stax': {

					let tax = interaction.fields.getTextInputValue('s-tax');

					if (!Helpers.isInt(tax) || tax > 100 || tax < 1) {
						return interaction.reply({ content: 'Sell tax must be a valid number between 0 and 100.', ephemeral: true });
					}

					_user.autoBuySettings.maximumSellTax = tax;
					await upsertSniperData(
						_user.discordId,
						{
							maximumSellTax: _user.autoBuySettings.maximumSellTax
						}
					);
					await _user.showAutoBuyFilters(interaction, true);

					return;
				}

				case 'set_tholder': {

					let tax = interaction.fields.getTextInputValue('holder_threshold');

					if (!Helpers.isInt(tax) || tax > 100 || tax < 1) {
						return interaction.reply({ content: 'Threshold must be a valid number between 0 and 100.', ephemeral: true });
					}

					_user.autoBuySettings.topHolderThreshold = tax;
					await upsertSniperData(
						_user.discordId,
						{
							topHolderThreshold: _user.autoBuySettings.topHolderThreshold
						}
					);
					await _user.showAutoBuyFilters(interaction, true);

					return;
				}

				case 'set_lockedliq': {

					let tax = interaction.fields.getTextInputValue('locked_liq');

					if (!Helpers.isFloat(tax)) {
						return interaction.reply({ content: 'ETH value must be a valid float.', ephemeral: true });
					}

					_user.autoBuySettings.minimumLockedLiq = ethers.utils.parseEther(tax);
					await upsertSniperData(
						_user.discordId,
						{
							minimumLockedLiq: _user.autoBuySettings.minimumLockedLiq
						}
					);
					await _user.showAutoBuyFilters(interaction, true);

					return;
				}

				case 'set_min_liq': {

					let tax = interaction.fields.getTextInputValue('min_liq');

					if (!Helpers.isFloat(tax)) {
						return interaction.reply({ content: 'ETH value must be a valid float.', ephemeral: true });
					}

					_user.autoBuySettings.minimumLiquidity = ethers.utils.parseEther(tax);
					await upsertSniperData(
						_user.discordId,
						{
							minimumLiquidity: _user.autoBuySettings.minimumLiquidity
						}
					);
					await _user.showAutoBuyFilters(interaction, true);

					return;
				}

				case 'uc_set_buy_amount_modal': {

					const amount = interaction.fields.getTextInputValue('uc_buy_amount');

					if (!Helpers.isFloat(amount)) {
						return interaction.reply({ content: 'ETH value must be a valid float.', ephemeral: true });
					}

					_user.autoBuySettings.buyAmount = amount;
					await upsertSniperData(
						_user.discordId,
						{
							buyAmount: _user.autoBuySettings.buyAmount
						}
					);
					await _user.showAutoBuyFilters(interaction, true);

					return;
				}
			}

		}

		// if we've gotten till here, that means that we're looking for auth
		if (!_user.account) {
			return interaction.reply({
				content: 'You must set a default wallet first.',
				ephemeral: true,
				embeds: [],
				components: []
			});
		}

		if (interaction.isStringSelectMenu()) {

			switch (interaction.customId) {

				case 'select_token': {

					if (_user.tokenList[interaction.values[0]] == null) {
						return interaction.reply({
							content: 'Something went wrong..',
							ephemeral: true
						});
					}

					// process
					await _user.selectFromTokenList(interaction, interaction.values[0])

					break;
				}

			}

		}
		else if (interaction.isModalSubmit()) {

			switch (interaction.customId) {

				case 'set_sell_percentage': {

					if (!Helpers.isInt(interaction.fields.getTextInputValue('sell-percentage'))) {
						return interaction.reply({ content: 'Sell percentage must be a valid number.', ephemeral: true });
					}

					_user.defaultConfig.sellPercentage = interaction.fields.getTextInputValue('sell-percentage');

					await _user.showSettings(interaction, true);

					break;
				}

				// case 'add_token': {

				// 	if(!ethers.utils.isAddress(interaction.fields.getTextInputValue('token-address'))) {
				// 		return interaction.reply({ content: 'Invalid token address specified.', ephemeral: true});
				// 	}

				// 	let status = await _user.addManualTokenToList(interaction.fields.getTextInputValue('token-address'));

				// 	if(!status) {

				// 		return interaction.reply({
				// 			content: 'Invalid token specified.',
				// 			embeds: [],
				// 			components: [],
				// 			ephemeral: true
				// 		});

				// 	}

				// 	await _user.showStart(interaction, true);

				// 	break;
				// }

				case 'buy_new': {
					await interaction.reply({ content: 'Checking buy requirements....', ephemeral: true, fetchReply: true });
					if (!ethers.utils.isAddress(interaction.fields.getTextInputValue('token-address'))) {
						return interaction.editReply({ content: 'Invalid token address specified.', ephemeral: true });
					}
					let gaslimit = interaction.fields.getTextInputValue('gas-limit');
					if (gaslimit.length != 0 && !Helpers.isInt(gaslimit)) {
						return interaction.editReply({ content: 'Gas limit must be a valid number.', ephemeral: true })
					}
					let input = interaction.fields.getTextInputValue('token-amount-eth').toString();
					if (!Helpers.isFloat(input)) {
						return interaction.editReply({ content: 'Token amount must be a valid number.', ephemeral: true });
					}

					await interaction.editReply({
						content: 'Transaction has been sent.',
						embeds: [],
						ephemeral: true
					});
					// overwrite with defaultConfig
					_user.config = _user.defaultConfig;

					// store gaslimit
					_user.config.gasLimit = !gaslimit ? _user.defaultConfig.gasLimit : gaslimit;

					// set values from form
					_user.config.inputAmount = ethers.utils.parseUnits(
						input,
						18
					);

					try {
						await _user.sendTransaction(interaction.fields.getTextInputValue('token-address'), input, _user.config.gasLimit, false, constants.TRADE_SORT.MANUAL);
					}
					catch (e) {
						console.log(`unexpected error on buying,  user : ${_user.discordId}` + e);
					}

					break;
				}

				case 'sell_new': {
					await interaction.reply({ content: 'Checking sell requirements....', ephemeral: true, fetchReply: true });
					if (!ethers.utils.isAddress(interaction.fields.getTextInputValue('token-address'))) {
						return await interaction.editReply({ content: 'Invalid token address specified.', ephemeral: true });
					}
					console.log(`token address input is ${interaction.fields.getTextInputValue('token-address')}`);

					let gaslimit = interaction.fields.getTextInputValue('gas-limit');

					if (gaslimit.length != 0 && !Helpers.isInt(gaslimit)) {
						return await interaction.editReply({ content: 'Gas limit must be a valid number.', ephemeral: true })
					}

					let percentage = interaction.fields.getTextInputValue('sell-percentage');

					if (!parseFloat(percentage) || parseFloat(percentage) < 0.01 || parseFloat(percentage) > 100) {
						return await interaction.editReply({ content: 'Sell percentage must be a valid number (0.01-100).', ephemeral: true });
					}

					await interaction.editReply({
						content: 'Transaction has been sent.',
						embeds: [],
						ephemeral: true
					});

					// overwrite with defaultConfig
					_user.config = _user.defaultConfig;

					// store gaslimit
					_user.config.gasLimit = !gaslimit ? _user.defaultConfig.gasLimit : gaslimit;

					// set values from form
					_user.config.sellPercentage = percentage;
					// do selling action
					try {
						await _user.sendTransaction(interaction.fields.getTextInputValue('token-address'), percentage, _user.config.gasLimit, true, constants.TRADE_SORT.MANUAL);
					}
					catch (e) {
						console.log(`unexpected error on selling, user : ${_user.discordId}` + e);
					}

					break;
				}

				case 'show_select_order_buy': {
					await interaction.reply({ content: 'Checking buy order requirements....', ephemeral: true, fetchReply: true });
					const orderAmount = interaction.fields.getTextInputValue('show_select_order_buy_amount').toString();
					if (!Helpers.isFloat(orderAmount)) {
						return interaction.editReply({ content: 'Order amount must be a valid number.', ephemeral: true });
					}

					const orderPercentage = interaction.fields.getTextInputValue('show_select_order_buy_percentage').toString();
					if (orderPercentage > 100 || orderPercentage <= 0) {
						return interaction.editReply({ content: 'Percentage must be a valid number between 0 and 100.', ephemeral: true });
					}


					const tokenDataByInteraction = await getTokenInfoByInteraction(interaction.message.id);
					const tokenAddress = tokenDataByInteraction?.tokenAddress;
					let curPrice;
					await interaction.editReply({ content: `Saving order for token(${tokenAddress}) data...`, ephemeral: true, fetchReply: true });
					try {
						curPrice = await _user.getCurTokenPrice(tokenAddress, orderAmount, true);
					}
					catch (err) {
						return await interaction.editReply({ content: err, ephemeral: true });
					}
					let msg = `Your orders were not saved! Please check your network!`;
					try {
						const newOrder = await Network.orderMnager.createOrder(interaction.user.id, tokenAddress, curPrice.toString(), Number(orderAmount), Number(orderPercentage), true);
						if (newOrder) {
							msg = `Your orders were saved successfully!`;
						}
					}
					catch (err) {
						console.log(`create order get failed: ${err}`)
					}

					await interaction.editReply({ content: msg, ephemeral: true });

					break;
				}

				case 'set_limit_order_buy': {
					let msg = `Your orders were not saved! Please check you network!`;
					await interaction.reply({ content: 'Checking buy order requirements....', ephemeral: true, fetchReply: true });
					const orderAmount = interaction.fields.getTextInputValue('set_limit_order_buy_amount').toString();
					if (!Helpers.isFloat(orderAmount)) {
						return interaction.editReply({ content: 'Order amount must be a valid number.', ephemeral: true });
					}

					const orderPercentage = interaction.fields.getTextInputValue('set_limit_order_buy_percentage').toString();
					if (orderPercentage > 100 || orderPercentage <= 0) {
						return interaction.editReply({ content: 'Percentage must be a valid number between 0 and 100.', ephemeral: true });
					}

					const tokenAddress = interaction.fields.getTextInputValue('set_limit_order_buy_token').toString();
					if (!ethers.utils.isAddress(tokenAddress)) {
						return interaction.editReply({ content: 'Invalid token address specified.', ephemeral: true });
					}

					await interaction.editReply({ content: `Saving order for token(${tokenAddress}) data...`, ephemeral: true, fetchReply: true });
					let curPrice;
					try {
						curPrice = await _user.getCurTokenPrice(tokenAddress, orderAmount, true);

						const newOrder = await Network.orderMnager.createOrder(interaction.user.id, tokenAddress, curPrice.toString(), Number(orderAmount), Number(orderPercentage), true);
						if (newOrder) {
							msg = `Your orders were saved successfully!`;
						}
					}
					catch (err) {
						console.log(`error when saving limit values to DB: ${err}`)
						msg = `Creating limit order get failed! Error : ` + err;
					}

					await interaction.editReply({ content: msg, ephemeral: true });

					break;
				}

				case 'show_select_order_sell': {
					await interaction.reply({ content: 'Checking sell order requirements....', ephemeral: true, fetchReply: true });
					const orderAmount = interaction.fields.getTextInputValue('show_select_order_sell_amount').toString();
					if (orderAmount > 100 || orderAmount <= 0) {
						return interaction.editReply({ content: 'Percentage must be a valid number between 0 and 100.', ephemeral: true });
					}

					const orderPercentage = interaction.fields.getTextInputValue('show_select_order_sell_percentage').toString();
					if (orderPercentage > 100 || orderPercentage <= 0) {
						return interaction.editReply({ content: 'Percentage must be a valid number between 0 and 100.', ephemeral: true });
					}

					const tokenDataByInteraction = await getTokenInfoByInteraction(interaction.message.id);
					const tokenAddress = tokenDataByInteraction?.tokenAddress;

					await interaction.editReply({ content: `Saving order for token(${tokenAddress}) data...`, ephemeral: true, fetchReply: true });
					let curPrice;
					try {
						curPrice = await _user.getCurTokenPrice(tokenAddress, 0, false);
					}
					catch (err) {
						return interaction.editReply({ content: "" + err, ephemeral: true });
					}
					let msg = `Your orders were not saved! Please check you network!`;
					try {
						const newOrder = await Network.orderMnager.createOrder(interaction.user.id, tokenAddress, curPrice.toString(), Number(orderAmount), Number(orderPercentage), false);
						if (newOrder) {
							msg = `Your orders were saved successfully!`;
						}
					}
					catch (err) {
						console.log(`error when saving limit values to DB: ${err}`)
						msg = `Creating limit order get failed! Error : ` + err;
					}

					await interaction.editReply({ content: msg, ephemeral: true });

					break;
				}

				case 'set_limit_order_sell': {
					await interaction.reply({ content: 'Checking sell order requirements....', ephemeral: true, fetchReply: true });
					const orderAmount = interaction.fields.getTextInputValue('set_limit_order_sell_amount').toString();
					if (orderAmount > 100 || orderAmount <= 0) {
						return interaction.editReply({ content: 'Percentage must be a valid number between 0 and 100.', ephemeral: true });
					}

					const orderPercentage = interaction.fields.getTextInputValue('set_limit_order_sell_percentage').toString();
					if (orderPercentage > 100 || orderPercentage <= 0) {
						return interaction.editReply({ content: 'Percentage must be a valid number between 0 and 100.', ephemeral: true });
					}

					const tokenAddress = interaction.fields.getTextInputValue('set_limit_order_sell_token').toString();
					if (!ethers.utils.isAddress(tokenAddress)) {
						return interaction.editReply({ content: 'Invalid token address specified.', ephemeral: true });
					}

					await interaction.editReply({ content: `Saving order for token(${tokenAddress}) data...`, ephemeral: true, fetchReply: true });
					let curPrice;

					try {
						curPrice = await _user.getCurTokenPrice(tokenAddress, 0, false);
						await interaction.editReply({ content: `Saving your order, token price is ${curPrice}`, ephemeral: true });
					}
					catch (err) {
						console.log(`error when get price of token with error: ${err}`);
						return await interaction.editReply({ content: `Get error when get price of token`, ephemeral: true });
					}
					console.log(`waiting for store order on db`);
					let msg = `Your orders were not saved! Please check you network!`;
					try {
						const newOrder = await Network.orderMnager.createOrder(interaction.user.id, tokenAddress, curPrice.toString(), Number(orderAmount), Number(orderPercentage), false);
						if (newOrder) {
							msg = `Your orders were saved successfully!`;
						}
					}
					catch (err) {
						console.log(`error when saving limit values to DB: ${err}`)
						msg = `Creating limit order get failed! Error : ` + err;
					}

					await interaction.editReply({ content: msg, ephemeral: true });

					break;
				}

				case 'set_priority_fee': {
					if (!Helpers.isFloat(interaction.fields.getTextInputValue('priority-fee'))) {
						return interaction.reply({ content: 'Input must be a valid number.', ephemeral: true });
					}

					_user.defaultConfig.maxPriorityFee = ethers.utils.parseUnits(interaction.fields.getTextInputValue('priority-fee'), 'gwei');

					await _user.showSettings(interaction, true);

					break;
				}

				case 'set_input_amount': {
					if (!Helpers.isFloat(interaction.fields.getTextInputValue('input-amount'))) {
						return interaction.reply({ content: 'Input must be a valid number.', ephemeral: true });
					}

					let formattedInput = ethers.utils.parseUnits(
						interaction.fields.getTextInputValue('input-amount').toString(),
						18
					);

					let bal = await _user.getBalance();

					if (bal.lt(formattedInput)) {
						return interaction.reply({ content: 'You don\'t have enough ETH.', ephemeral: true });
					}

					// store formatted input
					_user.defaultConfig.inputAmount = formattedInput;

					await _user.showSettings(interaction, true);

					break;
				}
				
				case 'show_pnl_modal': {
					const txHash = interaction.fields.getTextInputValue(`trade_transaction_hash`);
					
					await _user.showTradePNL(interaction, txHash);
					break;
				}

				case 'view_pnl_modal': {
					const inputTx= interaction.fields.getTextInputValue('tx_for_pnl');
					const tradeData = await getTradeInfoByTx(inputTx);
					const mentionedUser = UserCollection.get(tradeData.discordId);

					await mentionedUser.showTradePNL(interaction, inputTx, true);
					break;
				}
			}

		} else if (interaction.isButton()) {

			// actions that require a valid wallet
			switch (interaction.customId) {

				case 'start': {

					await _user.showStart(interaction);

					break;
				}

				case 'set_limit_order': {
					await _user.showOrderSetting(interaction);

					break;
				}
				case 'buy': {
					const tokenDataByInteraction = await getTokenInfoByInteraction(interaction.message.id);
					const tokenAddress = tokenDataByInteraction?.tokenAddress;
					const modal = new ModalBuilder()
						.setCustomId('buy_new')
						.setTitle('Buy A Token')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('token-address').setLabel('Token Address')
									.setStyle(TextInputStyle.Short).setMaxLength(42)
									.setValue(`${tokenAddress || ''}`)
									.setPlaceholder('0x123')
									.setRequired(true),
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('token-amount-eth').setLabel('Amount In ETH')
									.setStyle(TextInputStyle.Short)
									.setValue(_user.defaultConfig.inputAmount != null ? ethers.utils.formatUnits(_user.defaultConfig.inputAmount.toString(), 18) : '0.1').setPlaceholder('0.001')
									.setRequired(true),
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('gas-limit').setLabel('Gas Limit')
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMaxLength(10)
									.setPlaceholder('Leave empty to retrieve gaslimit automatically.'),
							),
						]);

					await interaction.showModal(modal);

					break;
				}

				case 'sell': {
					const tokenDataByInteraction = await getTokenInfoByInteraction(interaction.message.id);
					const tokenAddress = tokenDataByInteraction?.tokenAddress;
					const modal = new ModalBuilder()
						.setCustomId('sell_new')
						.setTitle('Sell A Token')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('token-address').setLabel('Token Address')
									.setStyle(TextInputStyle.Short).setMaxLength(42)
									.setValue(`${tokenAddress || ''}`)
									.setPlaceholder('0x123')
									.setRequired(true),
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('sell-percentage').setLabel('Sell Percentage')
									.setStyle(TextInputStyle.Short)
									.setValue(_user.defaultConfig.sellPercentage).setPlaceholder('10')
									.setRequired(true),
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('gas-limit').setLabel('Gas Limit')
									.setStyle(TextInputStyle.Short)
									.setRequired(false)
									.setMaxLength(10)
									.setPlaceholder('Leave empty to retrieve gaslimit automatically.'),
							),
						]);

					await interaction.showModal(modal);

					break;
				}

				case 'claim_invite_rewards': {
					await _user.claimInviteRewards(interaction);

					break
				}
				case 'claimable_amount': {
					await _user.showClaimableAmount(interaction);

					break
				}

				case 'set_limit_order_buy': {
					const modal = new ModalBuilder()
						.setCustomId('set_limit_order_buy')
						.setTitle('Set Order for Buying')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('set_limit_order_buy_token').setLabel('The Token Address')
									.setStyle(TextInputStyle.Short)
									.setValue(``)
									.setPlaceholder('Enter the token address')
									.setRequired(true),
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('set_limit_order_buy_percentage').setLabel('The % of Token Price Drops')
									.setStyle(TextInputStyle.Short)
									.setValue(`0`)
									.setPlaceholder('Enter the percentage between 1 and 100')
									.setRequired(true),
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('set_limit_order_buy_amount').setLabel('Buy Amount In ETH')
									.setStyle(TextInputStyle.Short)
									.setValue(`0`)
									.setPlaceholder('Enter the amount in ETH for buying token')
									.setRequired(true),
							)
						]);

					await interaction.showModal(modal);

					break;
				}

				case 'set_limit_order_sell': {
					const modal = new ModalBuilder()
						.setCustomId('set_limit_order_sell')
						.setTitle('Set Order for Selling')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('set_limit_order_sell_token').setLabel('The Token Address')
									.setStyle(TextInputStyle.Short)
									.setValue(``)
									.setPlaceholder('Enter the token address')
									.setRequired(true),
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('set_limit_order_sell_percentage').setLabel('The % of Token Price Increases')
									.setStyle(TextInputStyle.Short)
									.setValue(`0`)
									.setPlaceholder('Enter the percentage between 1 and 100')
									.setRequired(true),
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('set_limit_order_sell_amount').setLabel('The % of The Tokens To Sell')
									.setStyle(TextInputStyle.Short)
									.setValue(`0`)
									.setPlaceholder('Enter the percentage between 1 and 100')
									.setRequired(true),
							)
						]);

					await interaction.showModal(modal);

					break;
				}

				case 'show_select_order_buy': {

					const reply_ = interaction.message.reference;

					const tokenDataByInteraction = await getTokenInfoByInteraction(reply_.messageId);
					const tokenAddress = tokenDataByInteraction?.tokenAddress;

					await saveTokenInfoByInteraction(interaction.message.id, tokenAddress);
					const modal = new ModalBuilder()
						.setCustomId('show_select_order_buy')
						.setTitle('Set Buy Order')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('show_select_order_buy_percentage').setLabel(`The % of Drops`)
									.setStyle(TextInputStyle.Short)
									.setValue(`0`)
									.setPlaceholder('Enter the percentage between 1 and 100')
									.setRequired(true)
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('show_select_order_buy_amount').setLabel('Limit amount of order')
									.setStyle(TextInputStyle.Short)
									.setValue(`0`)
									.setPlaceholder('Enter the amount in ETH for buying token')
									.setRequired(true)
							)
						]);

					await interaction.showModal(modal);

					break;
				}

				case 'show_select_order_sell': {

					const modal = new ModalBuilder()
						.setCustomId('show_select_order_sell')
						.setTitle('Set Sell Order')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('show_select_order_sell_percentage').setLabel(`The % of Selling`)
									.setStyle(TextInputStyle.Short)
									.setValue(`0`)
									.setPlaceholder('Enter the percentage between 1 and 100')
									.setRequired(true),
							),
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('show_select_order_sell_amount').setLabel('The % of The Tokens To Sell')
									.setStyle(TextInputStyle.Short)
									.setValue(`0`)
									.setPlaceholder('Enter the percentage between 1 and 100')
									.setRequired(true),
							)
						]);

					await interaction.showModal(modal);

					break;
				}

				case 'show_select_order_list': {
					const tokenDataByInteraction = await getTokenInfoByInteraction(interaction.message.id);
					const tokenAddress = tokenDataByInteraction?.tokenAddress;

					const orderList = await Network.orderMnager.getWaitingOrdersByUser(interaction.user.id, tokenAddress);

					if (!orderList || orderList.length == 0) {
						return interaction.reply({ content: 'No order sets on this token.', ephemeral: true });
					}

					for (let i = 0; i < orderList.length; i++) {
						const order = orderList[i];
						const embedsData = [
							new EmbedBuilder()
								.setColor(0x000000)
								.setTitle(`Order List`)
								.setDescription(`This shows the order list`)
								.addFields(
									{ name: 'Mode', value: order?.isBuy ? `Buy` : `Sell`, inline: false },
									{ name: 'Amount', value: order?.isBuy ? `${order?.purchaseAmount.toFixed(3)}ETH` : `${order?.purchaseAmount.toFixed(3)}%`, inline: false },
									{ name: 'Token Address', value: `[${(Helpers.dotdot(order?.tokenAddress))}](https://etherscan.io/address/${order?.tokenAddress})`, inline: false },
									{ name: 'Percentage', value: `${order?.slippagePercentage}%`, inline: false },
									{ name: 'Status', value: `Waiting...`, inline: false },
									{ name: 'Transaction', value: order?.result ? order?.result : `waiting`, inline: false }
								)
						];
						if (i == 0) {
							const msg = await interaction.reply({
								content: `Show Order List`,
								ephemeral: true,
								embeds: embedsData,
								components: [
									new ActionRowBuilder().addComponents(
										// new ButtonBuilder().setCustomId('edit_order').setLabel('Edit').setStyle(ButtonStyle.Primary),
										new ButtonBuilder().setCustomId(`deleteorder_${order?._id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
									),
								]
							});
						}
						else {
							const msg = await interaction.followUp({
								content: `Show Order List`,
								ephemeral: true,
								embeds: embedsData,
								components: [
									new ActionRowBuilder().addComponents(
										new ButtonBuilder().setCustomId(`deleteorder_${order?._id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
									),
								]
							});
						}
					}
					break;
				}

				case 'show_limit_order': {
					const orderList = await Network.orderMnager.getOrdersByStatus(interaction.user.id, constants.ORDER_STATUS.WAITING);

					if (!orderList || orderList.length == 0) {
						return interaction.reply({ content: 'You set no order.', ephemeral: true });
					}

					for (let i = 0; i < orderList.length; i++) {
						const order = orderList[i];
						if (order?.status > 1) {
							continue;
						}
						const embedsData = [
							new EmbedBuilder()
								.setColor(0x000000)
								.setTitle(`Order List`)
								.setDescription(`This shows the order list`)
								.addFields(
									{ name: 'Mode', value: order?.isBuy ? `Buy` : `Sell`, inline: false },
									{ name: 'Amount', value: order?.isBuy ? `${order?.purchaseAmount.toFixed(3)}ETH` : `${order?.purchaseAmount.toFixed(3)}%`, inline: false },
									{ name: 'Token Address', value: `[${(Helpers.dotdot(order?.tokenAddress))}](https://etherscan.io/address/${order?.tokenAddress})`, inline: false },
									{ name: 'Percentage', value: `${order?.slippagePercentage}%`, inline: false },
									{ name: 'Status', value: `Waiting...`, inline: false },
								)
						];
						if (i == 0) {
							const msg = await interaction.reply({
								content: `Show Order List`,
								ephemeral: true,
								embeds: embedsData,
								components: [
									new ActionRowBuilder().addComponents(
										// new ButtonBuilder().setCustomId('edit_order').setLabel('Edit').setStyle(ButtonStyle.Primary),
										new ButtonBuilder().setCustomId(`deleteorder_${order?._id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
									),
								]
							});

						}
						else {
							const msg = await interaction.followUp({
								content: `Show Order List`,
								ephemeral: true,
								embeds: embedsData,
								components: [
									new ActionRowBuilder().addComponents(
										new ButtonBuilder().setCustomId(`deleteorder_${order?._id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
									),
								]
							});
						}
					}
					break;
				}

				case 'show_order_history': {
					const orderList = await Network.orderMnager.getOrdersByStatus(interaction.user.id, constants.ORDER_STATUS.SUCCESS);

					if (!orderList || orderList.length == 0) {
						return interaction.reply({ content: 'You have no finished orders.', ephemeral: true });
					}

					for (let i = 0; i < orderList.length; i++) {
						const order = orderList[i];
						if (order?.status < 2) {
							continue;
						}
						const embedsData = [
							new EmbedBuilder()
								.setColor(0x008000)
								.setTitle(`Finished Order List`)
								.setDescription(`This shows the finished order list`)
								.addFields(
									{ name: 'Mode', value: order?.isBuy ? `Buy` : `Sell`, inline: false },
									{ name: 'Amount', value: order?.isBuy ? `${order?.purchaseAmount.toFixed(3)}ETH` : `${order?.purchaseAmount.toFixed(3)}%`, inline: false },
									{ name: 'Token Address', value: `[${(Helpers.dotdot(order?.tokenAddress))}](https://etherscan.io/address/${order?.tokenAddress})`, inline: false },
									{ name: 'Percentage', value: `${order?.slippagePercentage}%`, inline: false },
									{ name: 'Status', value: `Finished`, inline: false },
									{ name: 'Transaction', value: order?.result || ``, inline: false }
								)
						];
						if (i == 0) {
							const msg = await interaction.reply({
								content: `Show Finished Order List`,
								ephemeral: true,
								embeds: embedsData,
								components: []
							});

						}
						else {
							const msg = await interaction.followUp({
								content: `Show Finished Order List`,
								ephemeral: true,
								embeds: embedsData,
								components: []
							});
						}
					}
					break;
				}

				case 'show_trade_history': {
					const tradeHistoryByUser = await getTradeHistory(interaction.user.id);

					if (!tradeHistoryByUser || tradeHistoryByUser.length == 0) {
						return interaction.reply({ content: 'You have no any trade.', ephemeral: true });
					}

					for (let i = 0; i < tradeHistoryByUser.length; i++) {
						const trade = tradeHistoryByUser[i];
						const parsedTradeAmount = ethers.utils.formatUnits(ethers.BigNumber.from(trade?.tradeAmount), trade?.tokenDecimals);
						const embedsData = [
							new EmbedBuilder()
								.setColor(0x000000)
								.setTitle(`Trade Detail Information`)
								.setDescription(trade?.tokenSymbol + "\n" + trade?.tokenAddress)
								.addFields(
									{ 
										name: 'Trade Date', 
										value: `<t:${Math.round(trade?.tradeAt.getTime() / 1000)}:R>`, 
										inline: false 
									}
								)
								.addFields(
									{ 
										name: 'Trade Mode', 
										value: trade?.tradeMode == constants.TRADE_MODE.SELL ? `SELL` : `BUY`, 
										inline: false 
									}
								)
								.addFields(
									{ 
										name: 'User Wallet Address', 
										value: `[${Helpers.dotdot(trade?.walletAddress)}](https://etherscan.io/address/${trade?.walletAddress})`, 
										inline: false 
									}
								)
								.addFields(
									{ 
										name: 'Trade Amount',  
										value: `${parsedTradeAmount} ${trade?.tradeMode === constants.TRADE_MODE.BUY ? 'ETH' : ''}`, 
										inline: false 
									}
								)
								.addFields(
									{ name: 'Transaction', value: `[LP Etherscan](https://etherscan.io/tx/${trade?.transaction})` }
								)
								.setURL(`https://etherscan.io/tx/${trade?.transaction}`)
						];
						if (i == 0) {
							const msg = await interaction.reply({
								content: `Show Trade History`,
								ephemeral: true,
								embeds: embedsData,
								components: []
							});

						}
						else {
							const msg = await interaction.followUp({
								content: `Show Trade History`,
								ephemeral: true,
								embeds: embedsData,
								components: []
							});
						}
					}
				}

				case 'show_pnl': {
					const modal = new ModalBuilder()
						.setCustomId('show_pnl_modal')
						.setTitle('Add Trade Transaction Hash')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('trade_transaction_hash')
									.setLabel('Enter the Trade Transaction Hash.')
									.setStyle(TextInputStyle.Paragraph)
									.setMaxLength(164)
									.setValue(``)
									.setPlaceholder('Transaction Hash')
									.setRequired(true)
							),
						]);

					await interaction.showModal(modal);

					break;
				}

				case 'limit_order': {
					const tokenDataByInteraction = await getTokenInfoByInteraction(interaction?.message?.id);
					const tokenAddress = tokenDataByInteraction?.tokenAddress;

					if (tokenAddress) {
						await _user.showSelectOrder(interaction, tokenAddress);
					}
					else {
						await interaction.reply({ content: 'Token Address is invalid!', ephemeral: true });
					}

					break;
				}

				// case 'ape': {



				// 	// overwrite with defaultConfig
				// 	_user.config = _user.defaultConfig;

				// 	_user.sendNormalTransactionApe(interaction, false);

				// 	await interaction.reply({
				// 		content: 'Transaction has been sent.',
				// 		embeds: [],
				// 		ephemeral: true
				// 	});

				// 	break;

				// }

				case 'set_input': {

					const modal = new ModalBuilder()
						.setCustomId('set_input_amount')
						.setTitle('Set Input Amount')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('input-amount').setLabel('Enter the amount you wish to spend.')
									.setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(64)
									.setValue(_user.defaultConfig.inputAmount != null ? ethers.utils.formatUnits(_user.defaultConfig.inputAmount.toString(), 18) : '0.1').setPlaceholder('0.1')
									.setRequired(true),
							),
						]);

					await interaction.showModal(modal);

					break;
				}

				case 'set_sell_percentage': {

					const modal = new ModalBuilder()
						.setCustomId('set_sell_percentage')
						.setTitle('Set Sell Percentage')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('sell-percentage').setLabel('Enter the sell percentage')
									.setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(3)
									.setValue(_user.defaultConfig.sellPercentage).setPlaceholder('10')
									.setRequired(true),
							)
						]);

					await interaction.showModal(modal);

					break;
				}

				case 'set_priority_fee': {

					const modal = new ModalBuilder()
						.setCustomId('set_priority_fee')
						.setTitle('Set Max Priority Fee')
						.addComponents([
							new ActionRowBuilder().addComponents(
								new TextInputBuilder()
									.setCustomId('priority-fee').setLabel('Enter the max priority fee in gwei')
									.setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(3)
									.setValue(ethers.utils.formatUnits(_user.defaultConfig.maxPriorityFee.toString(), 'gwei')).setPlaceholder('10')
									.setRequired(true),
							)
						]);

					await interaction.showModal(modal);

					break;
				}

				case 'delete': {

					// if token is not found, show start
					if (_user.tokenList[_user.savedToken] == null) {
						return _user.showStart(interaction, true);
					}

					// remove
					_user.tokenList.splice(_user.savedToken, 1);

					// reset
					_user.savedToken = null;

					// show main page
					await _user.showStart(interaction, true);

					break;
				}

				case 'back_to_start': {

					await _user.showStart(interaction, true);

					break;
				}

				case 'create_invite': {
					await interaction.reply({ content: `Creating invite link...`, ephemeral: true, fetchReply: true });

					const user = interaction.user;

					const userInfo = await getUserInfo(user.id);
					console.log(`User(${user.id}) is trying to generate invite link... `);

					if (userInfo?.referralLink && userInfo?.inviteCode) {
						return await interaction.editReply({ content: `You already have your invite link.(${userInfo?.referralLink})`, ephemeral: true });
					}

					const asap_token = await Network.tokenManager.update(process.env.ASAP_TOKEN);
					const _balance = await asap_token.ctx.balanceOf(_user.account.address);


					if (_balance.gte(ethers.utils.parseUnits(`${process.env.GEN_IVITLINK_MINIUM_TOKEN}`, asap_token.decimals))) {
						const inviteCode = await _user.generateReferralCode(interaction);
						console.log(`check whether user have referral code on contract before create invite link ... ${inviteCode}`);
						if (inviteCode) {
							const invite = await interaction.guild.systemChannel.createInvite({
								maxAge: constants.REFERRAL_LINK_EXPIRE_SEC,
								maxUses: constants.REFERRAL_LINK_MAX_USE,
								unique: true,
							});

							const userInviteLink = `${invite?.url}#${interaction.user.username}`;

							if (invite?.url) {
								const result = await setReferralLink(_user.discordId, userInviteLink, inviteCode);

								if (result) {
									client.joinerCounter[invite.code] = 0;
									console.log(`User(${user.id}) generate referral link  ${userInviteLink}`);
									await interaction.editReply({ content: `Congratulation! Your invite link is ${userInviteLink}`, ephemeral: true });
								}
								else {
									console.log(`User(${user.id}) get failed when generate referral code while store referral link to DB`);
									await interaction.editReply({ content: 'Creating Invite Link was failed!', ephemeral: true });
								}
							}
							else {
								console.log(`User(${user.id}) get failed when generate referral code from Discord API`);
								await interaction.editReply({ content: 'Creating Invite Link was failed! please try again..', ephemeral: true });
							}
						}
						else {
							console.log(`User(${user.id}) get failed when generate referral code from contract `);
						}

					}
					else {
						await interaction.editReply({ content: 'You do not have enough token amount to create invite link!', ephemeral: true });
					}

					break;
				}

				case 'show_auto': {
					if(!_user.isConfigCompleted()) {
						return interaction.reply({
							content: 'You must set the amount to buy in the config.',
							ephemeral: true,
							embeds: [],
							components: []
						});
					}

					await _user.showAutoStart(interaction);
					break;
				}

				case 'start_auto': {
					if(!_user.isConfigCompleted()) {
						return interaction.reply({
							content: 'You must set the amount to buy in the config.',
							ephemeral: true,
							embeds: [],
							components: []
						});
					}

					_user.autoBuySettings.autoBuying = true;
					await _user.showAutoStart(interaction);
					break;
				}

				case 'stop_auto': {
					_user.autoBuySettings.autoBuying = false;
					await _user.showAutoStart(interaction);
					break;
				}
			}

			if (interaction.customId.startsWith(`deleteorder`)) {
				const customId = interaction.customId;
				const dataId = customId.split('_')[1];
				const orderData = await Network.orderMnager.cancelOrder(dataId);
				if (orderData) {
					await interaction.update({
						content: `This order was deleted by user`,
						ephemeral: true,
						embeds: [
							new EmbedBuilder()
								.setColor(0xFF0000)
								.setTitle(`Order List`)
								.setDescription(`This shows the order list`)
								.addFields(
									{ name: 'Mode', value: orderData?.isBuy ? `Buy` : `Sell`, inline: false },
									{ name: 'Amount', value: orderData?.isBuy ? `${orderData?.purchaseAmount.toFixed(3)}ETH` : `${orderData?.purchaseAmount.toFixed(3)}%`, inline: false },
									{ name: 'Token Address', value: `[${(Helpers.dotdot(orderData?.tokenAddress))}](https://etherscan.io/address/${orderData?.tokenAddress})`, inline: false },
									{ name: 'Percentage', value: `${orderData?.slippagePercentage}%`, inline: false },
									{ name: 'Status', value: orderData.status == constants.ORDER_STATUS.WAITING ? `Canceled` : 'Processed', inline: false }
								)
						],
						components: []
					});

					await interaction.followUp({ content: 'The order was deleted successfully!', ephemeral: true });
				}

				return;
			}
		}

	});

	client.once(Events.ClientReady, async (c) => {

		console.log(`Logged in as ${c.user.tag}`);

		
		let content = JSON.parse((await fs.readFileSync('conf.json')));

		// store channels
		Network.channel_new_liquidity = c.channels.cache.get(process.env.CHANNEL_NEW_LIQUIDTY);
		Network.channel_new_liquidity.ignore_time = constants.ALERT_IGNORE_TIMES.CHANNEL_NEW_LIQUIDTY;
		Network.channel_locked_liquidity = c.channels.cache.get(process.env.CHANNEL_LOCKED_LIQUIDITY);
		Network.channel_locked_liquidity.ignore_time = constants.ALERT_IGNORE_TIMES.CHANNEL_LOCKED_LIQUIDITY;
		Network.channel_open_trading = c.channels.cache.get(process.env.CHANNEL_OPEN_TRADING);
		Network.channel_open_trading.ignore_time = constants.ALERT_IGNORE_TIMES.CHANNEL_OPEN_TRADING;
		Network.channel_burnt_liquidity = c.channels.cache.get(process.env.CHANNEL_BURNT_ALERT);
		Network.channel_burnt_liquidity.ignore_time = constants.ALERT_IGNORE_TIMES.CHANNEL_BURNT_ALERT;
		Network.channel_trading_history = c.channels.cache.get(process.env.CHANNEL_TRADING_HISTORY);
		Network.channel_trading_history.ignore_time = 36000000000; /// almost 1000 years

		// if channel is stored, delete the old one
		if (content.mainchannel) {

			let channel = c.channels.cache.get(content.mainchannel.id);

			if (channel) {
				await channel.delete();
			}
		}

		let guild = c.guilds.cache.get(process.env.SERVER_ID);

		// create new one
		content.mainchannel = await guild.channels.create({
			name: process.env.BOT_NAME,
			type: ChannelType.GuildText,
			permissionOverwrites: [
				{
					id: guild.roles.everyone,
					allow: [PermissionsBitField.Flags.ViewChannel],
				}
			]
		});

		// add to parent
		await content.mainchannel.setParent(process.env.WALLET_MANAGER_CATEGORY_ID);

		// Declare the admin channel
		const adminChannel = c.channels.cache.get(process.env.CHANNEL_ADMIN);

		if(!adminChannel) {
			console.log(`Can not find admin channel, Confirm the channel ID.`);
		}
		else {
			Network.admin_channel = adminChannel;
			try {
				const adminMessages = await adminChannel.messages.fetch({ limit: 100 });
				await adminChannel.bulkDelete(adminMessages);
			}
			catch(err) {
				console.log(`Error in clearing in the admin channel: ${err}`);
			}

			await adminChannel.send({
				content: 'Welcome to admin channel!',
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId('view_pnl').setLabel('View the PNL').setStyle(ButtonStyle.Primary)
					),
				]
			});
		}

		// save config
		fs.writeFileSync('conf.json', JSON.stringify(content));

		await content.mainchannel.send({
			content: 'Welcome, what do you want me to do?',
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('start').setLabel('Start').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('setup').setLabel('Config').setStyle(ButtonStyle.Secondary),
					new ButtonBuilder().setCustomId('create_wallet').setLabel('Create Wallet').setStyle(ButtonStyle.Secondary)

				),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('create_invite').setLabel('Create Invite Link').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('claim_invite_rewards').setLabel('Claim Invite Rewards').setStyle(ButtonStyle.Success),
					new ButtonBuilder().setCustomId('claimable_amount').setLabel('Claimable Amount').setStyle(ButtonStyle.Success)
				),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('show_auto').setLabel('Start Auto Buying').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('setup_auto').setLabel('Auto Buying Config').setStyle(ButtonStyle.Secondary),
				),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('set_limit_order').setLabel('Set Limit Order').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('show_limit_order').setLabel('Show Live Orders').setStyle(ButtonStyle.Secondary),
					new ButtonBuilder().setCustomId('show_order_history').setLabel('Order History').setStyle(ButtonStyle.Success),
					// new ButtonBuilder().setCustomId('test').setLabel('test').setStyle(ButtonStyle.Secondary),
				),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('show_trade_history').setLabel('The Last Trade').setStyle(ButtonStyle.Secondary),
					new ButtonBuilder().setCustomId('show_pnl').setLabel('Show PNL').setStyle(ButtonStyle.Primary)
				)
			]
		});
		Network.main_channel = content.mainchannel;
	});

	client.on(Events.GuildMemberAdd, async member => {
		const inviteManager = member.guild.invites;

		const guild_invites = await inviteManager.fetch();

		const usedInvite = guild_invites.find(
			(invite) => {
				try {
					if (client?.joinerCounter[invite.code] != null && client?.joinerCounter[invite.code] != undefined) {
						return invite.uses > client?.joinerCounter[invite.code]

					}
				}
				catch (err) {
					console.log(`err in fetch invites: ${err}`);
				}
				return false;
			}
		);
		console.log(`User(${member.displayName}) joined our server using ${usedInvite?.url}`);
		if (usedInvite && usedInvite?.code && usedInvite?.url) {

			client.joinerCounter[usedInvite?.code] = client.joinerCounter[usedInvite?.code] + 1;

			const creatorData = await getCreator(usedInvite?.url);
			console.log(`Get referral link's owner using link, ${creatorData?.discordId}`);
			const creator = creatorData?.discordId;

			if (creator) {
				try {
					await upsertAccountData(member.user.id, {
						joinType: constants.MEMBER_ADD_TYPE.REFERRAL,
						inviter: creator,
						discordName: member.user.username
					});
					await increaseReferralCount(creator, member.user.id);
				}
				catch (err) {
					console.log(`error increate referral count with: ${err}`)
				}
			}
			else {
				await upsertAccountData(member.user.id, {
					joinType: constants.MEMBER_ADD_TYPE.DIRECT,
					discordName: member.user.username
				});
			}
		}
		else {
			await upsertAccountData(member.user.id, {
				joinType: constants.MEMBER_ADD_TYPE.DIRECT,
				discordName: member.user.username
			});
		}
	});

	// login
	await client.login(process.env.TOKEN);
	await initUsers(client);
})();