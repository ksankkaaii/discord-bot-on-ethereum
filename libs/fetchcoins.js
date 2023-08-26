


// const { HoneypotIsV1 } = require('@normalizex/honeypot-is');
// const axios = require("axios");

// const getHoneypot = async (token_address) =>{
//     const CHAIN_ID = 1;
//     const honeypotis = new HoneypotIsV1();
//     const tokenAddress = token_address;
//     const tokenPairs = await honeypotis.getPairs(tokenAddress, CHAIN_ID);
//     const honeypotResult = await honeypotis.honeypotScan(
//       tokenAddress, 
//       tokenPairs[0].Router, 
//       tokenAddress[0].Pair,
//       CHAIN_ID
//     ).then((result) => {
//       return result;
//       /**
//         Token: {...},
//         WithToken: {...},
//         IsHoneypot: false,
//         Chain: {...},
//         ...etc...
//       */
//     });
//     return honeypotResult;
// }


// const Fetch = async () => {
//   try {
//     const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', {
//       headers: {
//         'X-CMC_PRO_API_KEY': '00bce15a-4218-434e-8ea8-c7e6d59c8943'
//       },
//       params: {
//         limit: 100,
//         sort: 'date_added', // Adjust the limit based on your needs
//       }
//     });
//     const tokens = response.data.data;
//     const startUTCTime = new Date().toISOString();
//     const start = new Date(startUTCTime).getTime();
//     const end = start - 60000;
//     const filteredByDateTokens = tokens.filter(token => {
//       const dateAdded = new Date(token.date_added).getTime();
//       return dateAdded >= end && dateAdded <= start && token.platform.name === 'Ethereum';
//     });
    
//     let filteredTokens =await Promise.all( filteredByDateTokens.map(async token => {
//       if(token.platform !== null){
//           const data = await getHoneypot(token.platform.token_address)
//           return data
//       }
//     }))
//     return filteredTokens
//   } catch (error) {
//     console.error('Error getting token data from CoinMarketCap:', error);
//     return null;
//   }
// };
// module.exports = Fetch;

// // setInterval(Fetch, 60000);

