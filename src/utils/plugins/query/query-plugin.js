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
const buildPipeline = require("./query-builder")
const split = require("../../utils/split")

const Moment = require("moment")
const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(Moment);


const _ = require("lodash")

const path = require("path")
const YAML = require("js-yaml")
const fs = require("fs")
const loadYaml = filename => YAML.load(fs.readFileSync(path.resolve(filename)).toString().replace(/\t/gm, " "))
const config = loadYaml(path.join(__dirname,"../../../.config/db/mongodb.conf.yml"))

const mongodb = require("../../utils/mongodb")


let pluginContext = {}

const resolveSource = collection => {
	return 	find(pluginContext.temp, c => c == `${pluginContext.id}-${collection}`) || collection
}

const transform = ( script, value, context ) => {
	try {
		script = script || "value => value"
		return eval(script)(value, context)

	} catch(e) {

		throw new Error( `Cannot execute transform:\n${script}\n${e.toString()}`)
	
	}
}


const close = async () => {
	try {
		for(let index = 0; index< pluginContext.temp.length; index++){
			         
	        console.log("DROP TEMP", pluginContext.temp[index])
	        await mongodb.drop(extend({}, config, {
	        	collection: `${config.db.name}.${pluginContext.temp[index]}`
	        }))
	    }

		pluginContext.temp = []
	} catch (e) {
		console.log(e.toString())
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

    close, 
    
    commands: [

        {
            name: ["query"],
            _execute: async (command, context) => {

            	const query = buildPipeline(pluginContext, command.query)

            	await mongodb.aggregate_raw({	
	            	db: config.db,
	            	collection: `${config.db.name}.${query.collection}`,
	            	pipeline: query.pipeline
	            })

            	return context
            }
        },
        {
        	name: ["purge", "close"],
            _execute: async (command, context) => {
            	for(let index = 0; index< pluginContext.temp.length; index++){
		         
		            console.log(`DROP TEMP COLLECTION ${pluginContext.temp[index]}`)
		            await mongodb.drop(extend({}, config, {
		            	collection: `${config.db.name}.${pluginContext.temp[index]}`
		            }))
		             

		        }

		        pluginContext.temp = []
                
                return context
            }
        },
        {
        	name: ["aggregate"],
            _execute: async (command, context) => {
            	// console.log(command)
                for (let i = 0; i < command.aggregate.length; i++) {
                    context = await builderInstance.executeOnce(command.aggregate[i], context)
                }
				return context
            }	
        },
        {
        	name: ["histogram", "hist"],
            _execute: async (command, context) => {
        
            	
        		command.histogram.label = (isArray(command.histogram.label)) ? command.histogram.label : [command.histogram.label]

                let pipeline = {
					$facet: {
					} 
				}
		
				command.histogram.label.forEach( f => {
					pipeline.$facet[f] = [
						{
							$unwind:{
					            path: `$${f}`,
					            preserveNullAndEmptyArrays: true
					        }
					    }, 
						{
					      "$group": {
					       "_id": `$${f}`,
					       "count": {
					        "$count": {}
					       }
					      }
					     },
					    {
					      "$project": {
					       "_id": 0,
					       "value": "$_id",
					       "count": "$count"
					      }
					    }
					]    
		    		
				})

				let value = await mongodb.aggregate_raw({	
	            	db: config.db,
	            	collection: `${config.db.name}.${resolveSource(command.histogram.from)}`,
	            	pipeline: [pipeline]
	            })
	
				value = transform( command.histogram.transform, value[0], context )
				
				set(context, command.histogram.into, value)
                
                return context
            }
        },

        {
        	name: ["timeline", "timeseries"],
            _execute: async (command, context) => {
        
       		
        		command.timeline.groupBy = (isArray(command.timeline.groupBy)) ? command.timeline.groupBy : [command.timeline.groupBy]

        		let pipeline = []

        		let current = {
        			$match: {}
        		}

        		current.$match[command.timeline.date] = { $ne: null }
        		pipeline.push(current)
				
				current = {
					$sort:{}
				}

				current.$sort[command.timeline.date] = 1
				pipeline.push(current)

				current = {
					$group:{
						_id: {},
						count:{
							$count:{}
						}
					}
				}
				current.$group._id[command.timeline.date] = `$${command.timeline.date}`
				command.timeline.groupBy.forEach(key => {
					current.$group._id[key] = `$${key}`
				})
				pipeline.push(current)

				current = {
					$project:{
						_id: 0,
						value: "$count"
					}
				}
				current.$project[command.timeline.date] = `$_id.${command.timeline.date}`
				command.timeline.groupBy.forEach(key => {
					current.$project[key] = `$_id.${key}`
				})
				pipeline.push(current)

				current = {
					$sort:{}
				}
				current.$sort[command.timeline.date] = 1
				pipeline.push(current)

				current = {
					$group:{
						_id: {},
						data:{
							$push:{
								value: '$value'		
							}
						}
					}
				}
				command.timeline.groupBy.forEach(key => {
					current.$group._id[key] = `$${key}`
				})
				current.$group.data.$push["date"] = `$${command.timeline.date}`
				pipeline.push(current)

				current = {
					$project:{
						_id: 0,
						id: "$_id",
						data: "$data"
					}
				}

				pipeline.push(current)


				let value = await mongodb.aggregate_raw({	
	            	db: config.db,
	            	collection: `${config.db.name}.${resolveSource(command.timeline.from)}`,
	            	pipeline
	            })


				value = value.map( v => {

					v.data = v.data.map( d => {
						d.date =  new Date(d.date)
						return d
					})
					return v
				})
				
				let dates = sortBy(flattenDeep( value.map( v => v.data.map( d => d.date ))))
				
				let start = moment(first(dates))
				let stop = moment(last(dates))
				
				let range = moment.range(start, stop)
				
				dates = Array.from(
					range.by(command.timeline.unit || "day", { step: command.timeline.binSize || 1})
				).map( d => d.toDate())
				
				value.forEach( serie => {
					serie.data = dates.map( (date, index) => {
						const f = find( serie.data, d => {
							let res = true

							if( index < dates.length-1){
								res = res && d.date.getTime() < dates[index+1].getTime()
							}
							if( index > 0){
								res = res && d.date.getTime() > dates[index-1].getTime()
							}
							return  res 
						})
						
						return {
								date,
								value: (f) ? f.value : 0 
						}
					})

					return serie
				})

				
				if(command.timeline.cumulative){
					
					value.forEach( serie => {
						let acc =0
						serie.data = serie.data.map( d => {
							acc += d.value
							d.value = acc
							return d
						}) 
						return serie
					})

				}

				value = transform( command.timeline.transform, value, context )

				set(context, command.timeline.into, value)
                
                return context
			
            }
        },

        {
        	name: ["count", "length"],
            _execute: async (command, context) => {
        
        		let pipeline = [{$count: "count"}]

				let value = await mongodb.aggregate_raw({	
	            	db: config.db,
	            	collection: `${config.db.name}.${resolveSource(command.count.from)}`,
	            	pipeline: pipeline
	            })

				value = transform( command.count.transform, value[0], context )

				set(context, command.count.into, value)
                
                return context

            }	
        },
        {
        	name: ["set", "fetch", "copy"],
            _execute: async (command, context) => {

            	try {
        		
	            	let cmd = command.set || command.fetch || command.copy

	        		let pipeline = [
					  {
					    '$match': {}
					  }, 
					  // {
					  //   '$limit': 150
					  // },
					  {
					  	$project:{
					  		_id: 0
					  	}
					  }
					]
					
					let value = await mongodb.aggregate_raw({	
		            	db: config.db,
		            	collection: `${config.db.name}.${resolveSource(cmd.from)}`,
		            	pipeline: pipeline //.concat([{$limit: 150}])
		            })
					
					value = transform( cmd.transform, value, context )
					
					set(context, cmd.into, value)
	                
	                return context
	            } catch (e) {
	            	throw e
	            }    

            }	
        },
        {
        	name: ["value", "const"],
            _execute: async (command, context) => {
        
				value = transform( command.value.transform, undefined, context )

				set(context, command.value.into, value)
                
                return context

            }	
        },

        {
        	name: ["split"],
            _execute: async (command, context) => {
        		
				let data = await mongodb.aggregate_raw({	
	            	db: config.db,
	            	collection: `${config.db.name}.${resolveSource(command.split.from)}`,
	            	pipeline: []
	            })

				command.split.from = data
				let value = split(command.split)
				value = transform( command.split.transform, value, context )
				set(context, command.split.into, value)
                return context

            }	
        },

        {
        	name: ["collection"],
            _execute: async (command, context) => {

            	if(!command.collection.name){
        			throw new Error(`Collection name required.`)
        		}

            	let collections = await mongodb.listCollections({	
	            	db: config.db
	            })
        		collections = collections.map( c => c.name)
        		
        		if(collections.includes(command.collection.name)){
        			throw new Error(`Collection "${command.collection.name}" already exists. Use external tools for drop it.`)
        		}
				
				let data = get(context, command.collection.from)
				
				if( !isArray(data)){
					throw new Error(`Collection: Data shuld be array.`)
				}

				await mongodb.insertAll({
					db: config.db,
	            	collection: `${config.db.name}.${command.collection.name}`,
	            	data
				})
				
				return context

            }	
        }    
    ]
}