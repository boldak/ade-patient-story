const mongodb = require("./utils/mongodb")
const path = require("path")
const YAML = require("js-yaml")
const fs = require("fs")

const loadYaml = filename => YAML.load(fs.readFileSync(path.resolve(filename)).toString().replace(/\t/gm, " "))

const config = loadYaml(path.join(__dirname,"../.config/db/mongodb.conf.yml"))


const getPageList = async (req, res) => {
	try {
		
		let options = req.body.options || {}
		let orderBy = options.orderBy || "updatedAt"

		let $sort = {}
		$sort[orderBy] = (orderBy == "updatedAt") ? -1 : 1

		let result = await mongodb.aggregate({
			db: config.db,
			collection: `${config.db.name}.${config.db.pageCollection}`,
			pipeline: [   
	            {
	                $project:{ 
	                	_id: 0,
	                	data: 0 
	                }
	            },
	            {
	            	$sort
	            }
	        ]
		})

		res.send(result)
	} catch (e) {
		res.send({
			error: e.toString()
		})
	}	
}

const getPage = async (req, res) => {
	try {
		
		let page = req.body.options.page

		let result = await mongodb.aggregate({
			db: config.db,
			collection: `${config.db.name}.${config.db.pageCollection}`,
			pipeline: [   
	            {
	            	$match:{
	            		id: page.id
	            	}
	            },
	            {
	                $project:{ 
	                	_id: 0 
	                }
	            }
	        ]
		})

		res.send(result[0])	

	} catch (e) {
		res.send({
			error: e.toString()
		})
	}
	
}



const deletePage = async (req, res) => {
	try {
		
		let page = req.body.options.page

		let result = await mongodb.deleteOne({
			db: config.db,
			collection: `${config.db.name}.${config.db.pageCollection}`,
			filter:{ id: page.id}
		})

		res.send(result)	
	
	} catch (e) {
		res.send({
			error: e.toString()
		})
	}
}

const updatePage = async (req, res) => {
	
	try {
		
		let page = req.body.options.page

		let result = await mongodb.replaceOne({
			db: config.db,
			collection: `${config.db.name}.${config.db.pageCollection}`,
			filter:{ id: page.id},
			data: page
		})

		res.send(result)	
	
	} catch (e) {
		res.send({
			error: e.toString()
		})
	}
}

const addPage = updatePage

module.exports = {
	getPageList,
	getPage,
	addPage,
	deletePage,
	updatePage
}