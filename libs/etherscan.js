const axios = require('axios');


// CJS
const {parse, stringify} = require('flatted');

class Etherscan {

	constructor() {

		this.endpoint = process.env.ETHER_SCAN_API;
		this.key = process.env.EHTERSCAN_API_KEY;

	}

	async call(params) {
			params.apikey = this.key;

			let response = await axios({
				method: 'get',
				url: this.endpoint + '?' + new URLSearchParams(params).toString()
			});
			
			if( response.data.status > 0)
				return response.data.result;
			console.log("Etherscan.call get failed " + JSON.stringify(params));
			throw new Error('Etherscan call failed reason is ' + JSON.stringify(response.data.result));
	}

}

module.exports = Etherscan;