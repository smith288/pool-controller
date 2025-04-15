module.exports = {
    usedSwitches: ['spa', 'pool', 'filter', 'lights'], // Changed pool and spa to single spa_pool toggle
    poolName: 'Hayward Pool',
    pinNumber: '0000',
    usePin: true,
    useTempControl: true,
    // Ensure basePath is properly formatted without leading or trailing slashes
    basePath: process.env.NODE_ENV === 'production' ? 'pool' : ''
};