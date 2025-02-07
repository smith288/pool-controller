module.exports = {
    usedSwitches: ['spa', 'pool', 'filter', 'lights'], // Changed pool and spa to single spa_pool toggle
    poolName: 'Hayward Pool',
    pinNumber: '0000',
    usePin: false,
    basePath: process.env.NODE_ENV === 'production' ? '/pool' : ''
};