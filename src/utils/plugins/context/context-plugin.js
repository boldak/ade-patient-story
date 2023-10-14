const UUID = require("uuid").v4

const { 
	first, 
	last, 
	template, 
	templateSettings, 
	extend, 
	isArray, 
	find, 
	set,
	get, 
	uniqBy, 
	flattenDeep, 
	sortBy, 
	min, 
	max
} = require("lodash")

const uuid = () => UUID()
const moment = require("moment")
const _ = require("lodash")
const path = require("path")

const transform = ( script, context ) => {
	try {
		script = script || "value => value"
		return eval(script)(context)

	} catch(e) {

		throw new Error( `Cannot execute transform:\n${script}\n${e.toString()}`)
	
	}
}



module.exports = {

    register: builder => {
        builderInstance = builder
		pluginContext = {
		    id: uuid(),
			temp: []
		}

    },

    commands: [


        {
        	name: ["context", "settings"],
            _execute: async (command, context) => {

            	command.context = command.context || command.settings

                for (let i = 0; i < command.context.length; i++) {
                    context = await builderInstance.executeOnce(command.context[i], context)
                }
				return context
            }	
        },

        {
        	name: ["extend"],
            
            _execute: async (command, context) => {
        		
        		let value
        		
        		if(command.extend.transform){
					value = transform( command.extend.transform, context )
				} else {
					value = command.extend 
				}
				context = extend(context, value)                
                return context

            }	
        }    
    ]
}