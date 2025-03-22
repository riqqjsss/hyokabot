const axios = require('axios');

module.exports = {
    async getIPDetails(ip) {
        try {
            const response = await axios.get(`http://ip-api.com/json/${ip}?fields=66842623`, {
                headers: {
                    'User-Agent': 'HyokaBot/1.0'
                }
            });

            return {
                country: response.data.country,
                city: response.data.city,
                isp: response.data.isp,
                vpn: response.data.proxy || response.data.hosting || false,
                as: response.data.as
            };
        } catch (error) {
            console.error('Erro na geolocalização:', error.message);
            return null;
        }
    }
};