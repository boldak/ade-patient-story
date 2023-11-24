const mongodb = require("./utils/mongodb")
const moment = require("moment")
const path = require("path")
const YAML = require("js-yaml")
const fs = require("fs")
const loadYaml = filename => YAML.load(fs.readFileSync(path.resolve(filename)).toString().replace(/\t/gm, " "))

const config = loadYaml(path.join(__dirname, "../.config/db/mongodb.conf.yml"))

const { extend, keys, find, isArray, groupBy, remove, first } = require("lodash")

const { loadForm } = require("./utils/docx-form")
const uuid = require("uuid").v4

const LOCALES = ["en", "uk"]
const DEFAULT_LOCALE = "en"

const TARGET_DIR = path.resolve('./.tmp/uploads/')


const getCount = async (req, res) => {

    try {

        const filter = req.body.filter || {}

        const textSearch = filter.search || ""
        const pid = filter.patientId || ".*"

        let searchStage = (textSearch) ? [{
            $search: {
                text: {
                    query: textSearch,
                    path: {
                        wildcard: "*",
                    },
                    fuzzy: {},
                },
            }
        }] : []

        // searchStage.push({
        // 	$match:{
        // 		"patientId": {
        //                 $regex: pid
        //             }
        // 	}
        // })

        const tags = filter.tags || []

        if (tags.length == 0) {
            res.status(200).send({ count: 0 })
        }

        let tagsStage = []

        let withoutTags = []


        withoutTags = remove(tags, t => t == "Without tags")
        tagsStage = {
            $match: {
                tag: {
                    $in: tags
                }
            }
        }


        let unionStage = []


        if (withoutTags.length > 0) {
            unionStage = {
                $unionWith: {
                    coll: config.db.docCollection,
                    pipeline: [{
                            $match: {
                                locale: DEFAULT_LOCALE,
	                        },
                            
                        },

                        {
                            $lookup: {
                                from: config.db.tagCollection,
                                localField: "id",
                                foreignField: "docId",
                                as: "tags",
                            },
                        },
                        {
                            $match: {
                                tags: {
                                    $size: 0,
                                },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                patientId: 1,
                            },
                        },
                    ],
                },
            }
        }


        let pipeline = []
            .concat(searchStage)
            .concat(tagsStage)
            .concat([

                {
                    $group: {
                        _id: "$docId",
                    },
                },

                {
                    $addFields: {
                        docId: "$_id",
                    },
                },

                {
                    $lookup: {
                        from: config.db.docCollection,
                        localField: "docId",
                        foreignField: "id",
                        as: "doc",
                    },
                },

                {
                    $unwind: {
                        path: "$doc",
                    },
                },

                {
                    $replaceRoot: {
                        newRoot: "$doc",
                    },
                },

                {
                    $match: {
                        locale: DEFAULT_LOCALE,
                        "patientId": {
	                        $regex: pid
	                    }
                    }
                },

                {
                    $project: {
                        _id: 0,
                        id: 1,
                        patientId: 1,
                    },
                },
            ])
            .concat(unionStage)
            .concat([
            	{
                	$match:{
                		"patientId": {
	                        $regex: pid
	                     }
                	}
                },
            ])
            .concat([{
                $count: "count"
            }])

        let result = await mongodb.aggregate({

            db: config.db,
            collection: `${config.db.name}.${config.db.tagCollection}`,
            pipeline
        })

        res.status(200).send(result[0])

    } catch (e) {
        res.status(200).send(e.toString())
    }
}


const getList = async (req, res) => {

    try {

        const pagination = req.body.pagination || {
            skip: 0,
            limit: 30
        }

        const filter = req.body.filter || {}

        const textSearch = filter.search || ""
        const pid = filter.patientId || ".*"


        let searchStage = (textSearch) ? [{
            $search: {
                text: {
                    query: textSearch,
                    path:{
                    	wildcard: "*"
                    },
                    fuzzy: {},
                },
            }
        }] : []

        // searchStage.push({
        // 	$match:{
        // 		"patientId": {
        //             $regex: pid
        //         }
        // 	}
        // })

        const tags = filter.tags || []

        let tagsStage = []

        let withoutTags = []


        withoutTags = remove(tags, t => t == "Without tags")
        tagsStage = {
            $match: {
                tag: {
                    $in: tags
                }
            }
        }


        let unionStage = []

        if (withoutTags.length > 0) {
            unionStage = {
                $unionWith: {
                    coll: config.db.docCollection,
                    pipeline: [{
                            $match: {
                                locale: DEFAULT_LOCALE
                            },
                            
                        },
                        {
                            $lookup: {
                                from: config.db.tagCollection,
                                localField: "id",
                                foreignField: "docId",
                                as: "tags",
                            },
                        },
                        {
                            $match: {
                                tags: {
                                    $size: 0,
                                },
                            },
                        },
                        {
                            $project: {
                                _id: 0,
                                id: 1,
                                lockedBy: 1,
                                lockedAt: 1,
                                patientId: 1,
                                updatedAt: 1
                            },
                        },
                    ],
                },
            }
        }

        let pipeline = []
            .concat(searchStage)
            .concat(tagsStage)
            .concat([

                {
                    $group: {
                        _id: "$docId",
                    },
                },

                {
                    $addFields: {
                        docId: "$_id",
                    },
                },

                {
                    $lookup: {
                        from: config.db.docCollection,
                        localField: "docId",
                        foreignField: "id",
                        as: "doc",
                    },
                },

                {
                    $unwind: {
                        path: "$doc",
                    },
                },

                {
                    $replaceRoot: {
                        newRoot: "$doc",
                    },
                },

                {
                    $match: {
                        locale: DEFAULT_LOCALE,
                        "patientId": {
	                        $regex: pid
	                     }   
                    }
                },

                {
                    $project: {
                        // _id: 0,
                        id: 1,
                        lockedBy: 1,
                        lockedAt: 1,
                        patientId: 1,
                        updatedAt: 1
                    },
                },
            ])
            .concat(unionStage)
            .concat([{
                    $lookup: {
                        from: config.db.tagCollection,
                        localField: "id",
                        foreignField: "docId",
                        as: "tags",
                    },
                },
                {
                	$match:{
                		"patientId": {
	                        $regex: pid
	                     }
                	}
                },
                {
                    $project: {
                        // _id: 0,
                        story: 0,
                        review: 0
                    },
                },
            ])
            .concat([

                {
                    $sort: {
                        updatedAt: -1,
                        // _id: -1
                    },
                },

                {
                    $skip: pagination.skip,
                },

                {
                    $limit: pagination.limit,
                }

            ])


        // console.log(JSON.stringify(pipeline))

        let result = await mongodb.aggregate({

            db: config.db,
            collection: `${config.db.name}.${config.db.tagCollection}`,
            pipeline
        })

        result = result.map(r => {

            let tags = groupBy(r.tags, t => t.tag)

            tags = keys(tags).map(key => ({
                tag: key,
                count: r.tags.filter(t => t.tag == key).length
            }))

            r.tags = tags

            return r
        })

        res.status(200).send(result)

    } catch (e) {
        res.status(200).send(e.toString())
    }
}


const updateStory = async (req, res) => {

    try {

        let story = req.body.story
        let user = req.body.user

        let stories = await mongodb.aggregate({

            db: config.db,
            collection: `${config.db.name}.${config.db.docCollection}`,
            pipeline: [{
                $match: {
                    patientId: story[DEFAULT_LOCALE].patientId
                }
            }]
        })

        for (let i = 0; i < stories.length; i++) {

            s = stories[i]
            s.updatedAt = new Date()
            s.updatedBy = user

            await mongodb.updateOne({
                db: config.db,
                collection: `${config.db.name}.${config.db.docCollection}`,
                filter: { id: s.id },
                data: s
            })

            await mongodb.deleteMany({
                db: config.db,
                collection: `${config.db.name}.${config.db.tagCollection}`,
                filter: { docId: s.id }
            })

        }


        for (let i = 0; i < LOCALES.length; i++) {
            let locale = LOCALES[i]

            let storyEntities = ((story[locale]) ? story[locale].storyEntities : []) || []
            let reviewEntities = ((story[locale]) ? story[locale].reviewEntities : []) || []

            storyEntities = storyEntities.map(e => {
                e.field = "story"
                e.docId = (story[locale]) ? story[locale].id : null
                return e
            })

            reviewEntities = reviewEntities.map(e => {
                e.field = "review"
                e.docId = (story[locale]) ? story[locale].id : null
                return e
            })


            let tags = storyEntities.concat(reviewEntities)

            if (tags.length > 0) {
                await mongodb.insertAll({
                    db: config.db,
                    collection: `${config.db.name}.${config.db.tagCollection}`,
                    data: tags
                })
            }

        }

        res.status(200).send()


    } catch (e) {

        res.status(200).send(e.toString())

    }

}


const getStory = async (req, res) => {

    try {

        const patientId = req.body.patientId
        const user = req.body.user

        let result = await mongodb.aggregate({

            db: config.db,
            collection: `${config.db.name}.${config.db.docCollection}`,
            pipeline: [{
                    $match: {
                        patientId
                    },
                },
                {
                    $lookup: {
                        from: config.db.tagCollection,
                        localField: "id",
                        foreignField: "docId",
                        as: "tags",
                    },
                },
                {
                    $addFields: {
                        storyEntities: {
                            $filter: {
                                input: "$tags",
                                as: "item",
                                cond: {
                                    $eq: ["$$item.field", "story"],
                                },
                            },
                        },
                        reviewEntities: {
                            $filter: {
                                input: "$tags",
                                as: "item",
                                cond: {
                                    $eq: ["$$item.field", "review"],
                                },
                            },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        tags: 0,
                    },
                },
            ]
        })

        if (first(result) && !first(result).lockedBy) {
            for (let i = 0; i < result.length; i++) {

                let r = result[i]

                r.lockedBy = user
                r.lockedAt = new Date()

                let data = extend({}, r)
                delete data.storyEntities
                delete data.reviewEntities

                await mongodb.updateOne({
                    db: config.db,
                    collection: `${config.db.name}.${config.db.docCollection}`,
                    filter: { id: data.id },
                    data
                })

            }
        }

        let story = {}
        LOCALES.forEach(locale => {
            story[locale] = find(result, r => r.locale == locale)
        })

        res.status(200).send(story)

    } catch (e) {

        res.status(200).send(e.toString())

    }

}

const releaseStory = async (req, res) => {

    try {

        const patientId = req.body.patientId
        const user = req.body.user

        let result = await mongodb.aggregate({

            db: config.db,
            collection: `${config.db.name}.${config.db.docCollection}`,
            pipeline: [{
                    $match: {
                        patientId
                    },
                },
                {
                    $project: {
                        _id: 0,
                    },
                },
            ]
        })

        for (let i = 0; i < result.length; i++) {

            let r = result[i]
            r.lockedBy = null
            r.lockedAt = null

            let op = await mongodb.updateOne({
                db: config.db,
                collection: `${config.db.name}.${config.db.docCollection}`,
                filter: { id: r.id },
                data: r
            })

        }

        res.status(200).send()

    } catch (e) {

        res.status(200).send(e.toString())

    }

}


const createStory = async (req, res) => {
    try {
        let filename = req.body.filename
        let filepath = path.resolve(TARGET_DIR, filename)

        let story = await loadForm(filepath)
        if (story.validation != true) {
            res.status(200).send(story)
            return
        }


        let stored = await mongodb.aggregate({

            db: config.db,
            collection: `${config.db.name}.${config.db.docCollection}`,
            pipeline: [{
                    $match: {
                        patientId: story.patientId
                    },
                },

                {
                    $lookup: {
                        from: config.db.tagCollection,
                        localField: "id",
                        foreignField: "docId",
                        as: "tags",
                    },
                },
                {
                    $set: {
                        tags: {
                            $size: "$tags",
                        },
                    },
                },
            ]
        })

        let storedDefault = find(stored, s => s.locale == DEFAULT_LOCALE)

        if (storedDefault && storedDefault.tags > 0) {
            res.status(200).send({
                validation: `Story for ${story.patientId} already exists and annotated.`,
                exists: true
            })
            return
        }

        let createdStory = find(stored, s => s.locale == story.locale)

        story.id = (createdStory) ? createdStory.id : uuid()

        await mongodb.replaceOne({
            db: config.db,
            collection: `${config.db.name}.${config.db.docCollection}`,
            filter: { id: story.id },
            data: story
        })

        res.status(200).send({
            patientId: story.patientId,
            locale: story.locale,
            validation: true
        })

    } catch (e) {
        res.status(200).send(e.toString())
    }
}


const getConfig = async (req, res) => {

    let result = await mongodb.aggregate({
        db: config.db,
        collection: `${config.db.name}.${config.db.configCollection}`,
        pipeline: [{
                $match: {}
            },
            {
                $project: { _id: 0 }
            }

        ]
    })

    result = result[0]
    res.send(result)

}

const getGrant = async (req, res) => {

    const user = req.body.user

    let grant = await mongodb.aggregate({
        db: config.db,
        collection: `${config.db.name}.${config.db.userCollection}`,
        pipeline: [{
                $match: {
                    email: user.email
                }
            },
            {
                $project: { _id: 0 }
            }

        ]
    })

    grant = grant[0]
    res.send(grant)

}


module.exports = {
    getGrant,
    getConfig,
    getStory,
    releaseStory,
    getCount,
    getList,
    updateStory,
    createStory
}