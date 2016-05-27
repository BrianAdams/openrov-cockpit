var ExternalLights = function ExternalLights(name, deps) 
{
    console.log('ExternalLights plugin loaded');

    var self            = this;
    var ArduinoHelper   = require('../../lib/ArduinoHelper')();
    this.lights         = [ 0, 0 ];

    // Cockpit
    deps.cockpit.on('plugin.externalLights.toggle', function( lightNum ) 
    {
        toggleLights( lightNum );
    });

    deps.cockpit.on('plugin.externalLights.adjust', function(lightNum, value) 
    {
        adjustLights(lightNum, value);
    });

    deps.cockpit.on('plugin.externalLights.set', function (lightNum, value) 
    {
        setLights(lightNum, value);
    });

    // Arduino
    deps.globalEventLoop.on( 'physicalInterface.status', function (data) 
    {
        if ('LIGPE0' in data) 
        {
            //value of 0-1.0 representing percent
            var level = data.LIGPE0;
            self.lights[ 0 ] = Number.parseFloat(level);
            deps.cockpit.emit('plugin.externalLights.state', 0, {level:level});
        }
        else if ('LIGPE1' in data) 
        {
            //value of 0-1.0 representing percent
            var level = data.LIGPE1;
            self.lights[ 1 ] = Number.parseFloat(level);
            deps.cockpit.emit('plugin.externalLights.state', 1, {level:level});
        }
    });

    var adjustLights = function adjustLights(lightNum, value) 
    {
        console.log("adjustLights[" + lightNum + "]: " + value);
        
        if (this.lights[ lightNum ] === 0 && value < 0) 
        {
            //this code rounds the horn so to speak by jumping from zero to max and vise versa
            this.lights[ lightNum ] = 0;  //disabled the round the horn feature
        } 
        else if (this.lights[ lightNum ] == 1 && value > 0) 
        {
            this.lights[ lightNum ] = 1;  //disabled the round the horn feature
        } 
        else 
        {
            this.lights[ lightNum ] = parseFloat(value) + parseFloat(this.lights[ lightNum ]);
        };

        setLights(this.lights[ lightNum ]);
    };

    var toggleLights = function toggleLights( lightNum ) 
    {
        if (this.lights[ lightNum ] > 0) 
        {
            setLights(lightNum, 0);
        } 
        else 
        {
            setLights(lightNum, 1);
        }
    };

    var setLights = function setLights( lightNum, value ) 
    {
        this.lights[ lightNum ] = value;

        if (this.lights[ lightNum ] >= 1)
        {
            this.lights[ lightNum ] = 1;
        }

        if (this.lights[ lightNum ] <= 0)
        {
            this.lights[ lightNum ] = 0;
        }

        var command = 'eligt' + lightNum +'(' + ArduinoHelper.serial.packPercent(this.lights[ lightNum ]) + ')';

        deps.globalEventLoop.emit( 'physicalInterface.send', command);
    };
};

module.exports = function (name, deps) 
{
    return new ExternalLights(name,deps);
};