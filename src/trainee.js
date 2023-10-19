const mongodb = require("./utils/mongodb")
const path = require("path")
const YAML = require("js-yaml")
const fs = require("fs")

const Builder = require("./utils/builder")
const { extend, keys, find, isArray } = require("lodash")

const getScore = require("./utils/score")

const loadYaml = filename => YAML.load(fs.readFileSync(path.resolve(filename)).toString().replace(/\t/gm, " "))

const config = loadYaml(path.join(__dirname,"../.config/db/mongodb.conf.yml"))



const getTraineeList = async (req, res) => {
	try {
		
		let result = await mongodb.aggregate({
			db: config.db,
			collection: `${config.db.name}.${config.db.userCollection}`,
			pipeline: [   
	            {
	                $project:{ 
	                	_id: 0,
	                }
	            }	        ]
		})

		res.send(result)
	} catch (e) {
		res.send({
			error: e.toString()
		})
	}	
}


const getTrainingStatus = async (req, res) => {

	try {


		let options = req.body.options || {}
		
		
		let result = await mongodb.aggregate({
			db: config.db,
			collection: `${config.db.name}.${config.db.trainingCollection}`,
			pipeline: [   
				{
					$match: {
						trainingId: options.trainingId 
					}
				},
	            {
	                $project:{ 
	                	_id: 0,
	                }
	            }	        ]
		})

		res.send(result)
	
	} catch (e) {
		res.send({
			error: e.toString()
		})
	}	

}

const getTraineeStat = async (req, res) => {

	try {

		let data = await mongodb.aggregate({
			db: config.db,
			collection: `${config.db.name}.${config.db.trainingCollection}`,
			pipeline: [
			  {
			    $group:
			      {
			        _id: {
			          state: "$state",
			          trainee: "$trainee",
			        },
			        trainings: {
			          $push: {
			            id: "$trainingId",
			            score: "$score",
			            state: "$state",
			          },
			        },
			      },
			  },
			  {
			    $addFields:
			      {
			        trainee: "$_id.trainee",
			        state: "$_id.state",
			      },
			  },
			  {
			    $group:
			      {
			        _id: "$trainee",
			        trainings: {
			          $push: {
			            state: "$state",
			            trainings: "$trainings",
			          },
			        },
			      },
			  },
			  {
			    $addFields:
			      {
			        trainee: "$_id",
			      },
			  },
			  {
			    $project:
			      {
			        _id: 0,
			      },
			  },
			]
		})

		const states = ["accepted", "rejected", "pending"]

		let result = data.map( d => {
			return {
				trainee: d.trainee,
				stat: states.map( s => {
					
					let f = find(d.trainings, t => t.state == s)
					
					return {
						state: (s == "pending") ? "OPEN" : s,
						count: (f) ? f.trainings.length : 0,
						score: (f) ? f.trainings.map( t => t.score).reduce((a,b) => a+(b||0), 0) : 0
					}

				})
			}
		})

		result.forEach( d => {
			d.total = d.stat.map( s => s.count).reduce((a,b) => a+b, 0)
			d.score = d.stat.map( s => s.score).reduce((a,b) => a+b, 0)
		}) 

		res.send(result)
	

	} catch (e) {
		res.send({
			error: e.toString()
		})
	}
}		

const assignTraining = async (req, res) => {

	try {

		let options = req.body.options || {}
		
		let commands = options.assignments.map( a => ({
			replaceOne: {
				filter:{
					trainingId: a.trainingId,
					trainee: a.trainee	
				},
				replacement: a,
				upsert: true
			}
		}))
	
		await mongodb.bulkWrite({
			db: config.db,
			collection: `${config.db.name}.${config.db.trainingCollection}`,
			commands
		})
	
		res.status(200).send()
	
	} catch (e) {
		res.send({
			error: e.toString()
		})
	}	

}

const cancelTraining = async (req, res) => {

	try {

		let options = req.body.options || {}

		let commands = options.cancelations.map( c => ({
			deleteOne:{
				filter:{
					trainingId: c.trainingId,
					trainee: c.trainee
				}
			}
		}))
		
		await mongodb.bulkWrite({
			db: config.db,
			collection: `${config.db.name}.${config.db.trainingCollection}`,
			commands
		})
	
	
		res.status(200).send()
	
	} catch (e) {
		res.send({
			error: e.toString()
		})
	}	

}


const debugTraining = async (req, res) => {

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

		let scoreRules = options.score
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
		res.status(200).send( result )
	
	} catch (e) {
		res.send({
			error: e.toString()
		})
	}	

}




module.exports = {
	getTraineeList,
	getTrainingStatus,
	assignTraining,
	cancelTraining,
	debugTraining,
	getTraineeStat
}


// Вы можете сделать это из браузера облачного хранилища Google: 
// https://console.cloud.google.com/storage/browser?project=StethophoneData