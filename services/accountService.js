const AccountModel = require('../models/account');

module.exports = {
	setUserWallet: async (discordId, walletPrivateKey, walletAddress, walletChanged, discordName) => {
        try {
            const filter = {
                discordId
            }
            const update = { $set: { walletPrivateKey: walletPrivateKey, walletAddress: walletAddress, walletChanged: walletChanged, discordName: discordName} };
    
            const info = await AccountModel.findOne(filter);
            
            if(info) {
                await AccountModel.updateOne(filter, update);
            }
            else {
                const newData = new AccountModel({...filter, walletPrivateKey: walletPrivateKey, walletAddress: walletAddress, walletChanged: walletChanged, discordName: discordName});
                await newData.save();
            }

            return true;
        }
        catch (err) {
            console.log("Error when setting user wallet to DB: " + err);
        }
    
        return false;
    },

    getUserInfo: async (discordId) => {
        try {
            const info = await AccountModel.findOne({
                discordId
            });
    
            return info;
        }
        catch(err) {
            console.log("Error getUserInfo from DB: " + err);
        }
    
        return null;
    },

    setReferralLink: async (discordId, referralLink, inviteCode) => {
        try {
            const filter = {
                discordId
            }
            const update = { $set: { referralLink: referralLink, inviteCode: inviteCode } };
    
            const info = await AccountModel.findOne(filter);
            
            if(info) {
                await AccountModel.updateOne(filter, update);
            }
            else {
                const newData = new AccountModel({...filter, referralLink: referralLink, inviteCode: inviteCode});
                await newData.save();
            }

            return true;
        }
        catch (err) {
            console.log("Error when setting referralLink info to DB: " + err);
        }
    
        return false;
    },

    increaseReferralCount: async (discordId, invitedUser) => {
        try {
            const filter = {
                discordId
            }

            const info = await AccountModel.findOne(filter);
            
            if(info) {
                const oldCnt = info?.joiners;
                if(Array.isArray(oldCnt)) {
                    oldCnt.push(invitedUser);
                    const update = { $set: { joiners: oldCnt } };
                    await AccountModel.updateOne(filter, update);
    
                    return oldCnt;
                }
            }
        }
        catch (err) {
            console.log("Error when setting joiners info to DB: " + err);
        }
    
        return null;
    },

    getCreator: async (referralLink) => {
        try {
            const pattern = new RegExp(`.*${referralLink}.*`);
            const filter = {
                referralLink: pattern
            }

            const info = await AccountModel.findOne(filter);
            
            return info;
        }
        catch (err) {
            console.log("Error when getCreator info to DB: " + err);
        }
    
        return null;
    },

    getInviter: async (invitedUser) => {
        try {
            const result = await AccountModel.findOne({
                joiners: {$in: [invitedUser]}
            });

            return result;
        }
        catch (err) {
            console.log("Error when getInviter: " + err);
        }
    
        return null;
    },

    upsertAccountData: async (discordId, data) => {
        try {
            const filter = { discordId };
            const update = { $set: data };

            const info = await AccountModel.findOne(filter);

            if(info) {
                await AccountModel.updateOne(filter, update);
            }
            else {
                const newData = new AccountModel({...filter, ...data});
                await newData.save();
            }

            return true;
        }
        catch (err) {
            console.log("Error when upsertAccountData in account service: " + err);
        }
    
        return false;
    },

    getAllAccounts: async () => {
        try {
            return await AccountModel.find();
        }
        catch (err) {
            console.log("Error getAllAccounts in account service: " + err);
        }

        return [];
    }
};