const Builder = require("./utils/builder")
const mongodb = require("./utils/mongodb")
const moment = require("moment")
const path = require("path")
const YAML = require("js-yaml")
const fs = require("fs")
const loadYaml = filename => YAML.load(fs.readFileSync(path.resolve(filename)).toString().replace(/\t/gm, " "))

const config = loadYaml(path.join(__dirname,"../.config/db/mongodb.conf.yml"))


const getScore = require("./utils/score")
const { extend, keys, find, isArray } = require("lodash")



const test = async (req, res) => {
	res.send("ADE LMS ready for use")
}

const buildPage = async (req, res) => {
	
	const pageId = req.params.id 

	let pageData = await mongodb.aggregate({
		db: config.db,
		collection: `${config.db.name}.${config.db.pageCollection}`,
		pipeline: [   
            {
                $match: { id: pageId }
            },
            {
                $project:{ _id: 0 }
            }
                    
        ]
	})

	pageData = (pageData) ? pageData[0] : null
	

	if(pageData){
		
		builder = new Builder()
		const result = await builder.execute(pageData.data, { pageId })
		res.send(result)	
	
	} else {
		res.send({error: "Not found"})
	}

}


const previewPage = async (req, res) => {
	
	const page = req.body.page 
	
	builder = new Builder()
	const result = await builder.execute(page.data, { pageId: page.id })
	res.send(result)	

}


const publishPage = async (req, res) => {
	try {	
		
		const page = req.body.page 
	

		let pageData = await mongodb.aggregate({
			db: config.db,
			collection: `${config.db.name}.${config.db.pageCollection}`,
			pipeline: [   
	            {
	                $match: { id: page.id }
	            },
	            {
	                $project:{ _id: 0 }
	            }
	                    
	        ]
		})

		pageData = (pageData) ? pageData[0] : null
		
		if(pageData){

			let title = pageData.name 
	
			builder = new Builder()
			const result = await builder.execute(pageData.data, { pageId: page.id })
			
			result.trainingTitle = title
			
			res.send(result)	
		
		} else {
			res.send({error: "Not found"})
		}
	} catch (e) {
		res.send({error: e.toString()})
	}	

}

const getTrainingStatus = async (req, res) => {
	
	try {
		const options = req.body.options 
		
		let pipeline = [
		  {
		    $match:
		      {
		        trainee: options.trainee,
		      },
		  },
		  {
		    $lookup:
		      {
		        from: config.db.pageCollection,
		        localField: "trainingId",
		        foreignField: "id",
		        as: "page",
		      },
		  },
		  {
		    $addFields:
		      {
		        page: {
		          $arrayElemAt: ["$page", 0],
		        },
		      },
		  },
		  {
		    $addFields:
		      {
		        trainingTitle: "$page.name",
		      },
		  },
		  {
		    $project:
		      {
		        _id: 0,
		        page: 0,
		      },
		  },
		]

	
		let result = await mongodb.aggregate({
			db: config.db,
			collection: `${config.db.name}.${config.db.trainingCollection}`,
			pipeline
		})

		res.send(result)

	} catch (e) {
		res.send({
			error: e.toString()
		})
	}	

}

const getStat = async (req, res) => {

	try {
	
		const options = req.body.options 

		let data = await mongodb.aggregate({
			db: config.db,
			collection: `${config.db.name}.${config.db.trainingCollection}`,
			pipeline: [
			  {
			    $match: {
			      trainee: options.trainee,
			    },
			  },
			  {
			    $group: {
			      _id: "$state",
			      count: {
			        $count: {},
			      },
			      score: {
			        $sum: "$score",
			      },
			    },
			  },
			  {
			    $project:
			      {
			        _id: 0,
			        state: "$_id",
			        count: 1,
			        score: 1,

			      },
			  },
			]
		})


		const states = ["accepted", "rejected", "pending"]

		let result = {
			stat: states.map( s => {

				let f = find(data, d => {
					return d.state == s
				})
				
				return {
					state: (s == "pending") ? "OPEN" : s,
					count: (f) ? f.count : 0 
				}

			})
		}

		result.total = result.stat.map( d => d.count ).reduce( (a,b) => a+b, 0)
		result.score = data.map( d => d.score).reduce((a,b) => a+b, 0)
		
		res.send(result)
	
	} catch (e) {
		res.send({error: e.toString()})
	}	


}		


const submitTraining = async (req, res) => {

	try {

		let options = req.body.options || {}

		let pageId = options.pageId

		let pageSource = await mongodb.aggregate({
			db: config.db,
			collection: `${config.db.name}.${config.db.pageCollection}`,
			pipeline: [   
	            {
	            	$match:{
	            		id: pageId
	            	}
	            },
	            {
	                $project:{ 
	                	_id: 0 
	                }
	            }
	        ]
		})

		builder = new Builder()
		const page = await builder.execute(pageSource[0].data, { pageId })

		let scoreRules = page.score
		let answers = options.answers

		let trainingResults = getScore(answers, scoreRules)

		let result = {
		  "trainingId": pageId,
		  "trainee": options.trainee,
		  "assignedAt": new Date(),
		  "expiresOn": new Date(),
		  "submitedAt": new Date(),
		  "score": trainingResults.score,
		  "percents": trainingResults.percents,
		  "state": trainingResults.state,
		  "data": {
		  	score: extend( {}, options.score, {total : trainingResults.score}),
		  	answers: trainingResults.answers,
		  	traineeActivity: options.traineeActivity
		  }
		}

		// console.log(result)
		
		await mongodb.replaceOne({
			db: config.db,
			collection: `${config.db.name}.${config.db.trainingCollection}`,
			filter:{ 
				trainingId: pageId,
			  	trainee: options.trainee,
			},
			data: result
		})

		res.status(200).send( result )
	
	} catch (e) {
		res.send({
			error: e.toString()
		})
	}	

}


const getGrant = async (req, res) => {
	
	const user = req.body.user 

	let grant = await mongodb.aggregate({
		db: config.db,
		collection: `${config.db.name}.${config.db.userCollection}`,
		pipeline: [   
            {
                $match: { 
                	email: user.email
                }
            },
            {
                $project:{ _id: 0 }
            }
                    
        ]
	})

	grant = grant[0]
	res.send(grant)
	
}


module.exports = {
	buildPage,
	previewPage,
	publishPage,
	getGrant,
	getTrainingStatus,
	submitTraining,
	getStat,
	test
}


