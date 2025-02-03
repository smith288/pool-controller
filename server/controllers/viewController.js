const poolConfig = require('../../config/poolConfig');

exports.index = (serialHandler) => (req, res) => {
    const switchStatuses = {};
    
    console.log('Current statuses:', serialHandler.currentStatuses);
    
    for (const [key, value] of Object.entries(serialHandler.currentStatuses)) {
        if (poolConfig.usedSwitches.includes(key)) {
            switchStatuses[key] = value ? 'On' : 'Off';
        }
    }

    console.log('Rendered switch statuses:', switchStatuses);

    res.render('index', { 
        switchStatuses, 
        currentLEDDisplay: serialHandler.commandHandler.currentLEDDisplay 
    });
};