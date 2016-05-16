var ArduinoHelper   = require('./ArduinoHelper');

var physicalInterface = function physicalInterface( name, deps ) 
{
    var controller          = this;
    var globalEventLoop     = deps.globalEventLoop;
    var cockpit             = deps.cockpit;
    var Hardware            = require('../' + deps.config.Hardware);
    
    var statusdata = {};
    var settingsCollection = 
    {
        smoothingIncriment: 0,
        deadZone_min: 0,
        deadZone_max: 0,
        water_type: 0 // FreshWater
    };

    var rovsys = 
    { 
        capabilities: 0 
    };
    
    this.physics            = new ArduinoHelper().physics;
    this.hardware           = new Hardware();
    
    // ----------------------------------------------------------------------
    // Register Hardware Event Handlers
    
    this.hardware.on( 'serial-recieved', function (data) 
    {
        globalEventLoop.emit( 'sys.physicalInterface.serial-recieved', data);
    });

    this.hardware.on('status', function (status) 
    {
        statusdata = {};

        for (var i in status) 
        {
            statusdata[i] = status[i];
        }

        globalEventLoop.emit('sys.physicalInterface.status', statusdata);

        if ('ver' in status) 
        {
            controller.ArduinoFirmwareVersion = status.ver;
        }

        if ('TSET' in status) 
        {
            var setparts                            = status.settings.split(',');
            settingsCollection.smoothingIncriment   = setparts[0];
            settingsCollection.deadZone_min         = setparts[1];
            settingsCollection.deadZone_max         = setparts[2];
            settingsCollection.water_type           = setparts[3];
            
            globalEventLoop.emit('sys.physicalInterface.Arduino-settings-reported', settingsCollection);
        }

        if ('CAPA' in status) 
        {
            var s                   = rovsys;
            s.capabilities          = parseInt(status.CAPA);
            controller.Capabilities = s.capabilities;
            globalEventLoop.emit('sys.physicalInterface.rovsys', s);
        }

        if ('cmd' in status) 
        {
            if (status.com != 'ping(0)')
            {
                globalEventLoop.emit('sys.physicalInterface.command', status.cmd);
            }
        }

        if ('log' in status)
        {
        }

        if ('boot' in status)
        {
            this.Capabilities = 0;
            controller.updateSetting();
            controller.requestSettings();
            controller.requestCapabilities();
        }
    });
    // ----------------------------------------------------------------------
  
    

    globalEventLoop.on('register-ArdunoFirmwareVersion', function (val) 
    {
        controller.ArduinoFirmwareVersion = val;
    });
    
    globalEventLoop.on('register-ArduinoCapabilities', function (val) 
    {
        controller.Capabilities = val;
    });

    globalEventLoop.on('SerialMonitor_start_rawSerial', function () 
    {
        controller.hardware.startRawSerialData();
    });

    globalEventLoop.on('SerialMonitor_stop_rawSerial', function () 
    {
        controller.hardware.stopRawSerialData();
    });

    globalEventLoop.on('serial-stop', function () 
    {
        logger.log('Closing serial connection for firmware upload');
        controller.hardware.close();
    });

    globalEventLoop.on('serial-start', function () 
    {
        controller.hardware.connect();
        controller.updateSetting();
        controller.requestSettings();
        controller.requestCapabilities();
    });
    
    // Connect to the hardware
    this.hardware.connect();
    controller.ArduinoFirmwareVersion   = 0;
    controller.Capabilities             = 0;

    //Every few seconds we check to see if capabilities or settings changes on the arduino.
    //This handles the cases where we have garbled communication or a firmware update of the arduino.
    setInterval(function () 
    {
        if (controller.notSafeToControl() === false) 
        {
            return;
        }
        
        controller.updateSetting();
        controller.requestSettings();
        controller.requestCapabilities();
    }, 1000);

    return controller;
};

physicalInterface.prototype.notSafeToControl = function () 
{
    // Arduino is OK to accept commands. After the Capabilities was added, all future updates require
    // being backward safe compatible (meaning you cannot send a command that does something unexpected but
    // instead it should do nothing).
    if (this.Capabilities !== 0)
    {
        return false;
    }

    return true;
};


physicalInterface.prototype.send = function (cmd) 
{
    var controller = this;
    if (controller.notSafeToControl())
    {
        return;
    }

    var command = cmd + ';';
    controller.hardware.write(command);
};

physicalInterface.prototype.requestCapabilities = function () 
{
    var command = 'rcap();';
    this.hardware.write(command);
};

physicalInterface.prototype.requestSettings = function () 
{
    //todo: Move to a settings manager
    var command = 'reportSetting();';
    this.hardware.write(command);
    command = 'rmtrmod();';
    this.hardware.write(command);
};

//TODO: Move the water setting to diveprofile
physicalInterface.prototype.updateSetting = function () 
{
    function watertypeToflag(type)
    {
        if(type=='fresh')
        {
            return 0;
        }

        return 1;
    }

    // This is the multiplier used to make the motor act linear fashion.
    // For example: the props generate twice the thrust in the positive direction than the negative direction.
    // To make it linear we have to multiply the negative direction * 2.
    var command = 'updateSetting('
        + CONFIG.preferences.get('smoothingIncriment') + ','
        + CONFIG.preferences.get('deadzone_neg') + ','
        + CONFIG.preferences.get('deadzone_pos') + ','
        + watertypeToflag(CONFIG.preferences.get('plugin:diveprofile:water-type')) + ');';
    
    this.hardware.write(command);
};

physicalInterface.prototype.sendMotorTest = function (port, starbord, vertical) 
{
    // The 1 bypasses motor smoothing
    var command = 'go(' + this.physics.mapRawMotor(port) + ',' +
        this.physics.mapRawMotor(vertical) + ',' +
        this.physics.mapRawMotor(starbord) + ',1)';
    
    this.send(command);
};

physicalInterface.prototype.sendCommand = function (throttle, yaw, vertical) 
{
    var motorCommands = this.physics.mapMotors(throttle, yaw, vertical);
    
    var command = 'go(' + motorCommands.port + ',' +
        motorCommands.vertical + ',' +
        motorCommands.starbord + ')';
        
    this.send(command);
};

physicalInterface.prototype.stop = function (value) 
{
    var command = 'stop()';
    this.send(command);
};

physicalInterface.prototype.start = function (value) 
{
    var command = 'start()';
    this.send(command);
};

physicalInterface.prototype.registerPassthrough = function(config) 
{
    if (config) 
    {
        if (!config.messagePrefix) 
        {
            throw new Error('You need to specify a messagePrefix that is used to emit and receive message.');
        }

        var messagePrefix = config.messagePrefix;

        if (config.fromROV) 
        {
            if (Array.isArray(config.fromROV)) 
            {
                config.fromROV.forEach(function(item) 
                {
                    self.on('status', function (data) 
                    {
                        if (item in data) 
                        {
                            self.cockpit.emit(messagePrefix+'.'+item, data[item]);
                        }
                    });
                });
            }
            else 
            { 
                throw new Error('config.fromROV needs to be an array.'); 
            }
        }

        if (config.toROV) 
        {
            if (Array.isArray(config.toROV)) 
            {
                config.toROV.forEach(function(item) 
                {
                    self.cockpit.on(messagePrefix+'.'+item, function(data) 
                    {
                        var args = Array.isArray(data) ? data.join() : data;
                        var command = item + '(' + args + ')';
                        self.send(command);
                    });
                });
            }
            else 
            { 
                throw new Error('config.toROV needs to be an array.');
            }
        }
    }
};

module.exports = function( name, deps )
{   
    return new controllerboardInterface( name, deps )
};
