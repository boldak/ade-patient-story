const { extend, isArray, keys, isString, get, isFunction, flatten, isObject, first } = require("lodash")
const YAML = require("js-yaml")
const moment = require("moment")

const publishPlugin = require("./plugins/publish/publish-plugin")
const contextPlugin = require("./plugins/context/context-plugin")

// const queryPlugin = require("./plugins/query/query-plugin")
const logPlugin = require("./plugins/publish/log-plugin")



const Builder = class {
	#plugins
	#commandImplementations
	#commandPath

	constructor(){
		this.#plugins = []
		this.#commandImplementations = []
		this.use([
			publishPlugin,
			contextPlugin,
			logPlugin
		])
	}

	use(plugins){
		plugins = (isArray(plugins)) ? plugins : [plugins]
		plugins.forEach( plugin => {
				this.#plugins.push(plugin)
				this.register(plugin)
		})
	}

	register(plugins){
		plugins = (isArray(plugins)) ? plugins : [plugins]
		plugins.forEach( plugin => {
			if(plugin.register) plugin.register(this)
			this.#commandImplementations = this.#commandImplementations.concat(plugin.commands || [])	
		})
	}

	async executeOnce(command, context, sender){
		
		// context.$log = context.$log || []
  //       context.$log += `\n[ ${moment(new Date()).format("YYYY.MM.DD HH:mm:ss")} ]:\n${YAML.dump(command)}`

		let commandName = first(keys(command))
		
		let executor = this.#commandImplementations.filter(rule => rule.name.includes(commandName))
		if( executor.length < 2){
			executor = executor[0]
		} else {
			throw new Error(`Multiple determination of "${commandName}". Command aliases (${flatten(executor.map( e => e.name)).join(", ")}) required.`)
		}

		if(executor){
			if(!isFunction(executor)){
				if(executor._execute){
					executor = executor._execute
				} else {
					throw new Error(`"${commandPath.join(".")}._execute" command not implemented`)		
				}
			}

			try {
				let ctx = await executor(command, context, sender)
				context = (isObject(ctx)) ? (!isArray) ? Object.assign({}, context, ctx) : ctx : ctx
				return context
			} catch (e) {
				throw e
			}		
		} else {
			throw new Error(`"${commandName}" command not implemented`)
		}
	}

	async execute(script, context){
		
		let i
		
		try {
		
			if(!script) return context


			if(isString(script)){
				script = YAML.load(script.replace(/\t/gm, " "))
			}

			script = (isArray(script)) ? script : [script]
			context = context || {}
			
			context._log = ""	
			
			this.#commandPath = []
			for( i=0; i < script.length; i++ ){
				let ctx = await this.executeOnce(script[i], context)
				context = (ctx) ? ctx : context  
			}

		
		} catch(e) {
			
			context._error = ` Error at script position ${i}.\n${YAML.dump(script[i])}\n${e.toString()}`
		
		} finally {
			
			for(let i=0; i < this.#plugins.length; i++){
				if( this.#plugins[i].close ) {
					await this.#plugins[i].close()
				}		
			}

			if(context._error){
			
				context._log += `\n[ ${moment(new Date()).format("YYYY.MM.DD HH:mm:ss")} ]: Report corrupted due to errors`
				context._log += `\n${context._error}`
			} else {
				
				context._log += `\n[ ${moment(new Date()).format("YYYY.MM.DD HH:mm:ss")} ]: Report completed successfully`
		
			}

			// context.$log += `\n[ ${moment(new Date()).format("YYYY.MM.DD HH:mm:ss")} ]: Report context`
			
			// let loggedContextFields = keys(context).filter( key => !key.startsWith("$"))
			
			// context.$log +=`{\n`
			
			// loggedContextFields.forEach( key => {
			// 	context.$log +=`${key}: `
			// 	let data = context[key]
			// 	let res
			// 	if(isArray(data) && data.length > 5 ){
			// 		res = data.map(d => JSON.stringify(d, null," ")).slice(0,6)
			// 		res.push(`... ${data.length-6} items`)
			// 		res = `[\n${res.join(",\n")}\n]`
			// 	} else {
			// 		res = JSON.stringify(data, null, " ")
			// 	}

			// 	context.$log += `${res},\n`
			
			// })			

			// context.$log +=`\n}`
			


			    
			return context
			
	
		}	
	}

}


module.exports = Builder