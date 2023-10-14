const UUID = require("uuid").v4
const { last, template, templateSettings, extend, isArray, get } = require("lodash")

const uuid = () => last(UUID().split("-"))

let compile = (_template, context) => {

    templateSettings.interpolate = /\$\{([\s\S]+?)\}/g;

    let result = template(_template)(context)

    templateSettings.interpolate = /<%=([\s\S]+?)%>/g;

    return result

}



const pieChart = require("./pie-chart")
const barChart = require("./bar-chart")
const timeChart = require("./time-chart")
const tableWidget = require("./table")
const oneOfWidget = require("./oneOf")
const manyOfWidget = require("./manyOf")
const frameWidget = require("./frame")
const submitWidget = require("./submit")



module.exports = {

    register: builder => {
   
        builderInstance = builder

    },


    commands: [

        {
            name: ["publish", "page"],
            _execute: async (command, context) => {
                command.publish = command.publish || command.page

                for (let i = 0; i < command.publish.length; i++) {
                    context = await builderInstance.executeOnce(command.publish[i], context)
                }
                return context
            }
        },

        {
        	name:["section"],
        	_execute: async (command, context) => {
 
        		let product = {
                    id: uuid(),
        			align: command.section.align || "justify-start",
        			holders:[]
        		}

        		for (let i = 0; i < command.section.columns.length; i++){
        			const h = await builderInstance.executeOnce(command.section.columns[i], context)
        			product.holders.push(h.product)
                    if(h.context){
                        context = h.context
                    } 
        		}

        		context._publish = context._publish || []
        		context._publish.push(product)
        		return context	
        	}
        },

        {
        	name:["column"],
        	_execute: async (command, context) => {
 
                const id = uuid()
        		let product = {
        			id, 
        			name: id,
        			width: command.column.width,
        			activated: false,
        			widgets: []
        		}

        		for (let i = 0; i < command.column.widgets.length; i++){
        			let w = await builderInstance.executeOnce(command.column.widgets[i], context)
                    if( !w.widget) {
                        w = {
                            widget: (isArray(w)) ? w : [w]
                        }
                    }
                    
                    if(w.context){
                        context = w.context
                    }

        			product.widgets = product.widgets.concat(w.widget) 
        		}

        		return {
                    product,
                    context
                }    

        	}
        },

        {
        	name:["markdown", "text", "md"],
        	_execute: async (command, context) => {

                command.markdown = command.markdown || command.text || command.md
        		let data = get(context, command.markdown.from) || context
                const id = uuid()

                let product = {
        		    type: "md-widget",
        		    icon: "mdi-language-markdown-outline",
        		    id,
        		    name: id,
        		    activated: false,

        		    "options": {
        		        "widget": {
        		            "visible": true
        		        },
                        style: `widget-style {${(command.decoration) ? command.decoration.style || "": ""}}`
        		    },
        		    "data": {
        		        "source": "embedded",
        		        "embedded": compile(command.markdown.content, data),
        		        "script": ""
        		    }

        		}

        		return product
        	}
        },

        {
        	name:["pie-chart"],
        	_execute: async (command, context) => {
                
                let data = get(context, command["pie-chart"].from)  || context 
                return pieChart(extend({}, command["pie-chart"], { from: data}))
            }
        },

        {
            name:["bar-chart"],
            _execute: async (command, context) => {
                
                let data = get(context, command["bar-chart"].from)  || context
                const res =  barChart(extend({}, command["bar-chart"], { from: data}))
                return res
            
            }
        },

        {
            name:["time-chart"],
            _execute: async (command, context) => {
                
                let data = get(context, command["time-chart"].from)  || context
                const res =  timeChart(extend({}, command["time-chart"], { from: data}))
                return res
            
            }
        },

        {
            name:["table"],
            _execute: async (command, context) => {
                
                let data = get(context, command["table"].from)  || context
                const res =  tableWidget(extend({}, command["table"], { from: data}))
                return res
            
            }
        },

        // {
        //     name:["download"],
        //     _execute: async (command, context) => {
                
        //         let data = get(context, command["download"].from)  || context
        //         const res =  downloadWidget(extend({}, command["download"], { from: data}), context)
        //         return res
            
        //     }
        // },
        {
            
            // oneOf:
                
            //     shuffle: true

            //     variants:
            //         - title: a
            //           score: 10
            //         - title: b  
            //         - title: c


            name:["oneOf"],
            _execute: async (command, context) => {
                const res =  oneOfWidget(command.oneOf, context)
                return res
            }
        },
        {
            
            // manyOf:
                
            //     shuffle: true

            //     variants:
            //         - title: a
            //           score: 5
            //         - title: b  
            //         - title: c
            //           score: 5 


            name:["manyOf"],
            _execute: async (command, context) => {
                const res =  manyOfWidget(command.manyOf, context)
                return res
            }
        },

        {
            
         
            name:["frame", "embedded"],

            _execute: async (command, context) => {
                command.frame = command.frame || command.embedded
                const res =  frameWidget(command.frame, context)
                return res
            }
        },

        {
            
         
            name:["submit"],

            _execute: async (command, context) => {
                const res =  submitWidget(command.submit, context)
                return res
            }
        }


        
        

    ]
}