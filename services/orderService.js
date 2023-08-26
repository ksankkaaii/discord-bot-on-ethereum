const OrderModel = require('./../models/order');
const constants = require('./../libs/constants');
module.exports = {
	createOrder: async (discordId, tokenAddress, mentionedPrice, purchaseAmount, slippagePercentage, isBuy) => {
        try {
            const newData = new OrderModel({discordId, tokenAddress, mentionedPrice, purchaseAmount, slippagePercentage, isBuy, status: constants.ORDER_STATUS.WAITING, createAt: new Date(), updateAt: new Date(), result: ``});
            return await newData.save();
        }
        catch (err) {
            console.log("Error when setting order info to DB: " + err);
        }
    
        return null;
    },
    /**
     * ex: [{key:discordID, value:00000}, {key:tokenAddress, value:0x333333}, {key:status, value:{ $gt :  0, $lt : 3}}}]
     */
    queryOrders: async(params)=>{
        if(params.length < 1) return [];
        let queryCondition = {}
        params.forEach(element => {
            queryCondition[element.key] = element.value
        });
        return await OrderModel.find(queryCondition);
    },


    deleteOrder: async (_id) => {
        try{
            const deletedCount =  await OrderModel.deleteOne({
                _id
            });

            if(deletedCount?.deletedCount) {
                return true;
            }
        }
        catch(err) {
            console.log(`Error when deleting order: ${err}`);
        }

        return false;
    },

    updateOrder: async (_id, status, result) => {
        try{
            const order =  await OrderModel.findById(_id);

            if(order) {
                await OrderModel.updateOne({_id: _id}, {status, result,updateAt:new Date()});
                return true;
            }
        }
        catch(err) {
            console.log(`Error orderExecuted: ${err}`);
        }

        return false;
    }
};