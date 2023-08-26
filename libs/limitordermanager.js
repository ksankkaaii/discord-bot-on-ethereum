const { queryOrders, createOrder, updateOrder } = require('../services/orderService');
const ethers = require('ethers');
const Network = require('./network.js');
const constants = require('./constants');
const UserCollection = require('./usercollection');
const {
	
	EmbedBuilder,
	
} = require('discord.js');
class LimitOrderManager {

	constructor() {
		/**
		 * this variable holds orders that are waiting for swap. 
		 * tokenAddress=>[orderData]
		 */
		this.orderList = [];
	}

	async init(networkInst) {
		console.log("Initializing Limit Order List from DB....");
		try {
			const orderFilter = [
				{ key: "status", value: constants.ORDER_STATUS.WAITING }
			]
			this.orderList = await queryOrders(orderFilter);
			this.network = networkInst;
			console.log(`Loaded ${this.orderList?.length} orders to swap`);

			// for (let i = 0; i < orderDetails?.length; i++) {
			// 	const token_addr = orderDetails[i]?.tokenAddress;
			// 	if (token_addr) {
			// 		if (!Array.isArray(this.orderList[token_addr]))
			// 			this.orderList[token_addr] = new Array();
			// 		this.orderList[token_addr].push(orderDetails[i]);
			// 	}
			// }
		}
		catch (err) {
			console.log(`LimitOrderManager initialization get failed : ${err}`);
		}

		console.log("Limit Order List is initialized from DB.");
	}

	async createOrder(discordId, tokenAddress, mentionedPrice, purchaseAmount, slippagePercentage, isBuy) {
		try {
			const res = await createOrder(discordId, tokenAddress, mentionedPrice, Number(purchaseAmount), Number(slippagePercentage), isBuy);
			if (res) {
				this.orderList.push(res);
				console.log(`Limit Order(${res._id.toString()}) is created for token(${res.tokenAddress}) by user(${res.discordId})`);
				return true;
			}
			// if (res) {
			// 	if (!this.orderList[tokenAddress]) {
			// 		this.orderList[tokenAddress] = new Array();
			// 	}
			// 	this.orderList[tokenAddress].push(res);
			// 	return res;
			// }
		}
		catch (err) {
			console.log(`CreateOrder get failed for user(${discordId}), token(${tokenAddress}): ${err}`);
		}
		return null;
	}

	getOrderDataByID(tokenAddr, orderId) {
		console.log(`getOrderDataByID (${tokenAddr}, ${orderId})`);
		const order_data = this.orderList[tokenAddr].find(order => order._id.toString() == orderId);
		console.log(`getOrderDataByID result : (${JSON.stringify(order_data)})`);
		return order_data;
	}
	//async getOrderList(tokenAddress) {
	async getWaitingOrdersByTokenaddress(tokenAddress) {
		return this.orderList.filter(order => order.tokenAddress == tokenAddress);
	}
	async getOrdersByStatus(discordId, status) {
		const orderFilter = [
			{ key: "discordId", value: discordId },
			{ key: "status", value: status }
		]
		const orderDetails = await queryOrders(orderFilter);
		return orderDetails;
	}
	async getWaitingOrdersByUser(discordId, tokenAddress) {
		return this.orderList.filter(order => (order.tokenAddress == tokenAddress && order.discordId == discordId));
	}

	async updateOrderStatus(_id, status) {

		if (status > constants.ORDER_STATUS.WAITING)
			this.orderList = this.orderList.filter(order => order._id.toString() != _id);
		return await updateOrder(_id, constants.ORDER_STATUS.PENDING, "");
	}
	async cancelOrder(_id) {

		const orderFilter = [
			{ key: "_id", value: _id }
		]
		const orderDetails = await queryOrders(orderFilter);
		if (orderDetails && Array.isArray(orderDetails) && orderDetails.length > 0) {
			const canceled_order = orderDetails[0];
			if (canceled_order.status != constants.ORDER_STATUS.WAITING) {
				console.log(`This order(${_id}) is already processed, user can't cancel it.`);
				return canceled_order;
			}
			this.orderList = this.orderList.filter(order => order._id.toString() != _id);
			await updateOrder(_id, constants.ORDER_STATUS.CANCELED, "User canceled.");
			return canceled_order;
		}
		return null;
	}
	async closeOrder(_id, status, result) {
		this.orderList = this.orderList.filter(order => order._id.toString() != _id);
		await updateOrder(_id, status, result);
	}

	async processOrders() {
		const promises = this.orderList.map(order => {
			//if (tokens[order.tokenAddress])
			{
				//console.log(`this token(${order.tokenAddress}) exist on order list.`);
				const token =  this.network.tokenManager.get(order.tokenAddress);
				if(token && this.fitOnCondition(order, token)) {
					console.log(`this token(${order.tokenAddress}) price fit on order(${order._id.toString()})'s condition.`);
					return this.processOrder(order);
				}
			} 
		});
		await Promise.all(promises);
		console.log(`Limit Order checked at ${this.network.Current_Block} `);
	}
	fitOnCondition(order, token) {
		const mentionedPrice = ethers.BigNumber.from(order?.mentionedPrice);
		const changedAmount = mentionedPrice.mul(order?.slippagePercentage * 10000).div(1000000);

		let slippedPrice;
		if (order?.isBuy) {
			slippedPrice = mentionedPrice.sub(changedAmount);
		}
		else {
			slippedPrice = mentionedPrice.add(changedAmount);
		}

		// console.log(`Order price is ${slippedPrice}`);

		// console.log(`Token's price is ${token.price}`);
		if (order?.isBuy) {
			return token.price.lte(slippedPrice);
		}
		else {
			return token.price.gte(slippedPrice);
		}
	}
	async processOrder(order) {
		if (order.status > constants.ORDER_STATUS.WAITING) return;
		const user = UserCollection.users[order.discordId];
		var msgsent = await user.discordUser.send({
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x0099FF)
					.setTitle('Processing limit order..')
					.setDescription(
						`Your limit order(${order._id.toString()}) for Token(${order.tokenAddress}) is starting ....`
					)
			],
			components: []
		});
		try {
			console.log(`Starting limit order(${order._id.toString()}) for user(${order.discordId})`);
			const is_updated = await this.updateOrderStatus(order._id.toString(), constants.ORDER_STATUS.PENDING)
			if (is_updated) {
				console.log(`Order (${order._id.toString()}) Status is set by pending`);
				let txHash;
				txHash = await user.sendTransaction(order.tokenAddress, `${order.purchaseAmount}`, user.defaultConfig.gasLimit, !order.isBuy, constants.TRADE_SORT.LIMIT_ORDER);
				await msgsent.edit({
					content: '',
					embeds: [
						new EmbedBuilder()
							.setColor(0x0099FF)
							.setTitle('Limit Order Success')
							.setDescription(
								`Your limit order(${order._id.toString()}) for Token(${order.tokenAddress}) get success. Transaction Hash is` + txHash
							)
					],
					components: [],
				});
				this.closeOrder(order._id.toString(), constants.ORDER_STATUS.SUCCESS, txHash);
			}

		}
		catch (e) {
			// await msgsent.edit({
			// 	content: '',
			// 	embeds: [
			// 		new EmbedBuilder()
			// 			.setColor(0x0099FF)
			// 			.setTitle('Limit Order failed')
			// 			.setDescription(
			// 				`Your limit order(${order._id.toString()}) for Token(${order.tokenAddress}) get failed. reason is` + e
			// 			)
			// 	],
			// 	components: [],
			// });
			this.closeOrder(order._id.toString(), constants.ORDER_STATUS.FAILED, e);
		}
	}
}

module.exports = LimitOrderManager;