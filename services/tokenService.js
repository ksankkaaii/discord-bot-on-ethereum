const TokenModel = require('./../models/token');

module.exports = {
    fetchToken: async (req, res) => {
        try {
            const token = await TokenModel.findOne({
                token: req.body.token
            });    
            res.status(200).json(token);   
            
        } catch (error) {
            
        }

        return null;
    },

    fetchTokens: async (req, res) => {
        try {
            const token = await TokenModel.findOne({
                token: req.body.token
            });    
            res.status(200).json(token);   
            
        } catch (error) {
            
        }

        return [];
    },

    updateToken: async (tokenAddress, update) => {
        try {
            const token = await TokenModel.findOne({
                token: req.body.token
            });    
            res.status(200).json(token);   
            
        } catch (error) {
            
        }

        return [];
    },

    deleteToken: async (tokenAddress) => {
        try {
            const token = await TokenModel.findOne({
                token: req.body.token
            });    
            res.status(200).json(token);   
            
        } catch (error) {
            
        }

        return [];
    }
};