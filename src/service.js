const mongodb = require("./utils/mongodb")
const moment = require("moment")
const path = require("path")
const YAML = require("js-yaml")
const fs = require("fs")
const loadYaml = filename => YAML.load(fs.readFileSync(path.resolve(filename)).toString().replace(/\t/gm, " "))

const config = loadYaml(path.join(__dirname, "../.config/db/mongodb.conf.yml"))

const { 
        extend, 
        keys, 
        find, 
        isArray, 
        groupBy, 
        remove, 
        first,
        isUndefined,
        isNull,
        flattenDeep 
} = require("lodash")


const { loadForm } = require("./utils/docx-form")
const uuid = require("uuid").v4

const LOCALES = ["en", "uk"]
const DEFAULT_LOCALE = "en"

const TARGET_DIR = path.resolve('./.tmp/uploads/')


const getSortStage = filter => {
    const name2field = {
     "Patient ID": "patientId", 
     "Docs": "docCount", 
     "Updated at": "updatedAt"
    }
    let data = filter.sort.split(",").map( d => d.trim())
    let res = {$sort:{}}
    res.$sort[name2field[data[0]]] = (data[1] == "A-Z") ? 1 : -1

    return res
}


const getCount = async (req, res) => {
    try {

                const filter = req.body.filter || {}

        const textSearch = (filter.hasText) ? filter.search || "" : ""
        const pid = (filter.hasPatients) ? filter.patientId || ".*" : ".*"
        const withoutTags = (isUndefined(filter.withoutTags) || isNull(filter.withoutTags)) ? true : filter.withoutTags 
        const hasTags = (isUndefined(filter.hasTags) || isNull(filter.hasTags)) ? false : filter.hasTags 
        const requiredDocuments = (filter.hasDocs) ? filter.requiredDocuments || [] : [] 
        const missingDocuments = (filter.misDocs) ? filter.missingDocuments || [] : [] 
        
        const tags = (hasTags) ? filter.tags || [] : []
        
        let tagSelector = (tags.length > 0) 
            ? {
                $match: {
                    tag: {
                        $in: tags,
                    },
                },
            }
            : { $match: {} }



        let searchStage = (textSearch) ? {
            $search: {
                text: {
                    query: textSearch,
                    path: {
                        wildcard: "*"
                    },
                    fuzzy: {},
                },
            }
        } : { $match: {} }


        let patientStage = [
            {
                $addFields: {
                  docsCount: {
                    $size: "$docs",
                  },
                  hasTags: {
                    $cond: {
                      if: {
                        $eq: [
                          {
                            $type: "$tags",
                          },
                          "missing",
                        ],
                      },
                      then: false,
                      else: true,
                    },
                  },
                },
            },
            {
                $match: {
                    docsCount: {
                        $gt: 0,
                    },
                },
            },
            {
                $match: {
                    patientId: {
                        $regex: pid,
                    },
                },
            }
        ]

        let docStage = (requiredDocuments.length > 0) 
            ? [
                {
                $match: {
                    "docs.type": {
                        $all: requiredDocuments,
                    },
                },
            }]  
            : [] 

        let misDocStage = (missingDocuments.length > 0) 
            ? [
                {
                $match: {
                    "docs.type": {
                        $nin: missingDocuments,
                    },
                },
            }]  
            : [] 
                
        let hasTagStage = [{
                $lookup: {
                    from: config.db.docCollection,
                    localField: "patientId",
                    foreignField: "patientId",
                    as: "docs",
                },
            },
            {
                $unwind: {
                    path: "$docs",
                },
            },
            {
                $lookup: {
                    from: config.db.tagCollection,
                    localField: "docs.id",
                    foreignField: "docId",
                    as: "tags",
                    pipeline: [

                        searchStage,
                        tagSelector
                    ],
                },
            },
            {
                $unwind: {
                    path: "$tags",
                },
            },

        ]


        let withoutTagStage = [
            {
                $match:{
                    hasTags: false
                }
            }
        ]

        let aggregateStage = [
                {
                $group: {
                    _id: "$patientId",
                },
            },
            {
                $lookup: {
                    from: config.db.patientCollection,
                    localField: "_id",
                    foreignField: "patientId",
                    as: "patient",
                },
            },
            {
                $unwind: {
                    path: "$patient",
                },
            },
            {
                $replaceRoot: {
                    newRoot: "$patient",
                },
            }
        ]



        let pipeline = []

        if(hasTags){
            
            if(withoutTags){
                pipeline = pipeline.concat(patientStage).concat(docStage).concat(misDocStage).concat(hasTagStage).concat([
                    {
                        $unionWith:{
                            coll: config.db.patientCollection,
                            pipeline: [].concat(patientStage).concat(docStage).concat(misDocStage).concat(withoutTagStage)
                        }    
                    }
                ])
            } else {
                pipeline = pipeline.concat(patientStage).concat(docStage).concat(misDocStage).concat(hasTagStage)
            }
        
        } else {
        
            if(withoutTags){
                pipeline = pipeline.concat(patientStage).concat(docStage).concat(misDocStage).concat(withoutTagStage)
            } else {
                pipeline = pipeline.concat(patientStage).concat(docStage).concat(misDocStage)       
            }
        }

        pipeline = pipeline
                .concat([
                    {
                        $group:{
                            _id: "$patientId"
                        }
                    },
                    {
                        $count: "count"
                    }
                ])

        // console.log(JSON.stringify(pipeline))

        let result = await mongodb.aggregate({

            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
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

        const textSearch = (filter.hasText) ? filter.search || "" : ""
        const pid = (filter.hasPatients) ? filter.patientId || ".*" : ".*"
        const withoutTags = (isUndefined(filter.withoutTags) || isNull(filter.withoutTags)) ? true : filter.withoutTags 
        const hasTags = (isUndefined(filter.hasTags) || isNull(filter.hasTags)) ? false : filter.hasTags 
        const requiredDocuments = (filter.hasDocs) ? filter.requiredDocuments || [] : [] 
        const missingDocuments = (filter.misDocs) ? filter.missingDocuments || [] : [] 
        
        const tags = (hasTags) ? filter.tags || [] : []
        
        let tagSelector = (tags.length > 0) 
            ? {
                $match: {
                    tag: {
                        $in: tags,
                    },
                },
            }
            : { $match: {} }



        let searchStage = (textSearch) ? {
            $search: {
                text: {
                    query: textSearch,
                    path: {
                        wildcard: "*"
                    },
                    fuzzy: {},
                },
            }
        } : { $match: {} }


        let patientStage = [
            {
                $addFields: {
                  docsCount: {
                    $size: "$docs",
                  },
                  hasTags: {
                    $cond: {
                      if: {
                        $eq: [
                          {
                            $type: "$tags",
                          },
                          "missing",
                        ],
                      },
                      then: false,
                      else: true,
                    },
                  },
                },
            },
            {
                $match: {
                    docsCount: {
                        $gt: 0,
                    },
                },
            },
            {
                $match: {
                    patientId: {
                        $regex: pid,
                    },
                },
            }
        ]

        let docStage = (requiredDocuments.length > 0) 
            ? [
                {
                $match: {
                    "docs.type": {
                        $all: requiredDocuments,
                    },
                },
            }]  
            : [] 

        let misDocStage = (missingDocuments.length > 0) 
            ? [
                {
                $match: {
                    "docs.type": {
                        $nin: missingDocuments,
                    },
                },
            }]  
            : [] 


        let hasTagStage = [{
                $lookup: {
                    from: config.db.docCollection,
                    localField: "patientId",
                    foreignField: "patientId",
                    as: "docs",
                },
            },
            {
                $unwind: {
                    path: "$docs",
                },
            },
            {
                $lookup: {
                    from: config.db.tagCollection,
                    localField: "docs.id",
                    foreignField: "docId",
                    as: "tags",
                    pipeline: [

                        searchStage,
                        tagSelector
                    ],
                },
            },
            {
                $unwind: {
                    path: "$tags",
                },
            },

        ]


        let withoutTagStage = [
            {
                $match:{
                    hasTags: false
                }
            }
        ]

        let aggregateStage = [
                {
                $group: {
                    _id: "$patientId",
                },
            },
            {
                $lookup: {
                    from: config.db.patientCollection,
                    localField: "_id",
                    foreignField: "patientId",
                    as: "patient",
                },
            },
            {
                $unwind: {
                    path: "$patient",
                },
            },
            {
                $replaceRoot: {
                    newRoot: "$patient",
                },
            }
        ]



        let pipeline = []

        if(hasTags){
            
            if(withoutTags){
                pipeline = pipeline.concat(patientStage).concat(docStage).concat(misDocStage).concat(hasTagStage).concat([
                    {
                        $unionWith:{
                            coll: config.db.patientCollection,
                            pipeline: [].concat(patientStage).concat(docStage).concat(misDocStage).concat(withoutTagStage)
                        }    
                    }
                ])
            } else {
                pipeline = pipeline.concat(patientStage).concat(docStage).concat(misDocStage).concat(hasTagStage)
            }
        
        } else {
        
            if(withoutTags){
                pipeline = pipeline.concat(patientStage).concat(docStage).concat(misDocStage).concat(withoutTagStage)
            } else {
                pipeline = pipeline.concat(patientStage).concat(docStage).concat(misDocStage)       
            }
        }

        pipeline = pipeline
                .concat(aggregateStage)
                .concat([
                    {
                        $addFields:{
                            docCount:{
                                $size: "$docs"
                            }
                        }
                    },
                    getSortStage(filter),
                    // {
                    //     $sort: {
                    //         updatedAt: -1,
                    //     },
                    // },

                    {
                        $skip: pagination.skip,
                    },

                    {
                        $limit: pagination.limit,
                    }

                ])


        let result = await mongodb.aggregate({

            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
            pipeline
        })

        result = result.map(r => {

            let tagArray = flattenDeep(r.tags)
            let tags = groupBy(tagArray, t => t.tag)

            tags = keys(tags).map(key => ({
                tag: key,
                count: tagArray.filter(t => t.tag == key).length
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
        let patientId = story.patientId

        let patientRecord = await mongodb.aggregate({
            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
            pipeline: [{
                $match: {
                    patientId
                },
            }, ]
        })

        patientRecord = first(patientRecord)

        patientRecord.updatedAt = new Date()
        patientRecord.updatedBy = user

        for (let i = 0; i < story.docs.length; i++) {

            s = story.docs[i]
            if (!s) continue

            // s.updatedAt = new Date()
            // s.updatedBy = user

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

        let foundedTags = []

        for (let i = 0; i < story.docs.length; i++) {
            
            let storyEntities = ((story.docs[i]) ? story.docs[i].storyEntities : []) || []
            let reviewEntities = ((story.docs[i]) ? story.docs[i].reviewEntities : []) || []

            storyEntities = storyEntities.map(e => {
                e.field = "story"
                e.docId = (story.docs[i]) ? story.docs[i].id : null
                return e
            })

            reviewEntities = reviewEntities.map(e => {
                e.field = "review"
                e.docId = (story.docs[i]) ? story.docs[i].id : null
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

            foundedTags = foundedTags.concat(tags)

        }

        // console.log(foundedTags)
        
        let tags = groupBy(foundedTags, t => t.tag)

        tags = keys(tags).map(key => ({
            tag: key,
            count: foundedTags.filter(t => t.tag == key).length
        }))

        // console.log(tags)

        if(tags.length == 0){
            delete patientRecord.tags
        } else {
            patientRecord.tags = tags
        }

        await mongodb.replaceOne({
                db: config.db,
                collection: `${config.db.name}.${config.db.patientCollection}`,
                filter: { patientId },
                data: patientRecord
            })


        res.status(200).send()


    } catch (e) {

        res.status(200).send(e.toString())

    }

}


const getStory = async (req, res) => {

    try {

        const patientId = req.body.patientId
        const user = req.body.user

        const pipeline = [{
                $match: {
                    patientId
                },
            },
            {
                $lookup: {
                    from: `${config.db.examCollection}`,
                    localField: "patientId",
                    foreignField: "patientId",
                    as: "ex",
                },
            },
            {
                $unwind: {
                    path: "$ex",
                },
            },
            {
                $lookup: {
                    from: `${config.db.recordCollection}`,
                    localField: "ex.id",
                    foreignField: "examination_id",
                    as: "records",
                },
            },
            {
                $unwind: {
                    path: "$records",
                },
            },
            {
                $group: {
                    _id: "$patientId",
                    patientId: {
                        $first: "$patientId",
                    },
                    examinationsCount: {
                        $first: "$examinationsCount",
                    },
                    lockedAt: {
                        $first: "$lockedAt",
                    },
                    lockedBy: {
                        $first: "$lockedBy",
                    },

                    records: {
                        $push: {
                            examinationId: "$records.examination_id",
                            createdAt: "$records.file_created_at",
                            type: "$records.record_type",
                            spot: "$records.record_spot",
                            side: "$records.record_body_side",
                            position: "$records.record_body_position",
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "docs",
                    localField: "patientId",
                    foreignField: "patientId",
                    as: "docs",
                },
            },
            {
                $unwind: {
                    path: "$docs",
                },
            },
            {
                $addFields: {
                    "docs.examinationsCount": "$examinationsCount",
                    "docs.records": "$records",
                    "docs.lockedAt": "$lockedAt",
                    "docs.lockedBy": "$lockedBy",
                },
            },
            {
                $replaceRoot: {
                    newRoot: "$docs",
                },
            },
            {
                $lookup: {
                    from: `${config.db.tagCollection}`,
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
            {
                $group: {
                    _id: "$patientId",
                    lockedAt: {
                        $first: "$lockedAt"
                    },
                    lockedBy: {
                        $first: "$lockedBy"
                    },
                    examinationsCount: {
                        $first: "$examinationsCount",
                    },
                    records: {
                        $first: "$records",
                    },
                    docs: {
                        $push: "$$ROOT",
                    },
                },
            },
            {
                $addFields: {
                    patientId: "$_id",
                },
            },
        ]

         let result = await mongodb.aggregate({

            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
            pipeline

        })

        let patientRecord = await mongodb.aggregate({
            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
            pipeline: [{
                $match: {
                    patientId
                },
            }, ]
        })

        patientRecord = first(patientRecord)

        if (patientRecord && !patientRecord.lockedBy) {

            patientRecord.lockedBy = user
            patientRecord.lockedAt = new Date()
            await mongodb.updateOne({
                db: config.db,
                collection: `${config.db.name}.${config.db.patientCollection}`,
                filter: { patientId: patientRecord.patientId },
                data: patientRecord
            })
        }

        result = result[0] || {}
            
        result.lockedBy = patientRecord.lockedBy
        result.lockedAt = patientRecord.lockedAt
        

        res.status(200).send(result)

    } catch (e) {

        res.status(200).send(e.toString())

    }

}

const releaseStory = async (req, res) => {

    try {

        const patientId = req.body.patientId
        const user = req.body.user

        let patientRecord = await mongodb.aggregate({
            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
            pipeline: [{
                $match: {
                    patientId
                },
            }, ]
        })

        patientRecord = first(patientRecord)

        if (patientRecord && patientRecord.lockedBy) {

            patientRecord.lockedBy = null
            patientRecord.lockedAt = null
            
            await mongodb.updateOne({
                db: config.db,
                collection: `${config.db.name}.${config.db.patientCollection}`,
                filter: { patientId },
                data: patientRecord
            })
        
        }

        res.status(200).send()

    } catch (e) {

        res.status(200).send(e.toString())

    }

}


const createSAF = async (req, res) => {
    try {
        
        const user = req.body.user
        let filename = req.body.filename
        let url = req.body.url
        let patientId = path.basename(filename,".pdf")
       
        let patientRecord = await mongodb.aggregate({
            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
            pipeline: [{
                $match: {
                    patientId: patientId
                },
            }, ]
        })

        patientRecord = first(patientRecord)

        if (!patientRecord) {
            let story = {
                validation: `Cannot attach the Sound Assessment Form. Patient code "${patientId}" not found.`
            }
            res.status(200).send(story)
            return
        }

        
        let documentType = "Sound Assessment Form"

        let existedDoc = find( patientRecord.docs, d => d.type == documentType )

        if(existedDoc){
            existedDoc.url = url
        } else {
            existedDoc = {
                id: uuid(),
                patientId,
                type: documentType,
                url    
            }
            patientRecord.docs.push(existedDoc)
        }
        
        await mongodb.replaceOne({
            db: config.db,
            collection: `${config.db.name}.${config.db.docCollection}`,
            filter: { id: existedDoc.id },
            data: existedDoc
        })

        patientRecord.updatedAt = new Date()
        patientRecord.updatedBy = user

        await mongodb.updateOne({
            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
            filter: { patientId },
            data: patientRecord
        })


        res.status(200).send({
            patientId,
            documentType,
            validation: true
        })

    } catch (e) {
        res.status(200).send(e.toString())
    }
}

const createPS = async (req, res) => {
    try {
        
        const user = req.body.user
        let filename = req.body.filename
        let url = req.body.url
        let filepath = path.resolve(TARGET_DIR, filename)

        let story = await loadForm(filepath)

        if (story.validation != true) {
            res.status(200).send(story)
            return
        }

        let patientRecord = await mongodb.aggregate({
            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
            pipeline: [{
                $match: {
                    patientId: story.patientId
                },
            }, ]
        })

        patientRecord = first(patientRecord)

        if (!patientRecord) {
            story.validation = `Cannot attach the Patient Story. Patient code "${story.patientId}" not found.`
            res.status(200).send(story)
            return
        }

        if (patientRecord.tags) {
            res.status(200).send({
                validation: `Story for ${story.patientId} already exists and annotated.`,
                exists: true
            })
            return
        }

        let documentType = (story.locale == "en") ? "Patient Story (english)" : "Patient Story (original)"

        let existedDoc = find( patientRecord.docs, d => d.type == documentType )

        if(existedDoc){
            story.id = existedDoc.id
            existedDoc.url = url
        } else {
            story.id = uuid()
            patientRecord.docs.push({
                id: story.id,
                type: documentType,
                locale: story.locale,
                url
            })
        }
        
        await mongodb.replaceOne({
            db: config.db,
            collection: `${config.db.name}.${config.db.docCollection}`,
            filter: { id: story.id },
            data: story
        })

        patientRecord.updatedAt = new Date()
        patientRecord.updatedBy = user

        await mongodb.updateOne({
            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
            filter: { patientId: story.patientId },
            data: patientRecord
        })


        res.status(200).send({
            patientId: story.patientId,
            documentType,
            validation: true
        })

    } catch (e) {
        res.status(200).send(e.toString())
    }
}


const createStory = async (req, res) => {
    try {

        let ext = path.extname(req.body.filename)
        if( ext.toUpperCase() == ".pdf".toUpperCase()){
            await createSAF(req, res)
        } else {
            await createPS(req, res)
        }

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



const updateUrl = async (req, res) => {
    try {
        
        let story = req.body

        const user = req.body.user
        let patientId = req.body.patientId
        let url = req.body.url
        let documentType = req.body.documentType
        
        let patientRecord = await mongodb.aggregate({
            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
            pipeline: [{
                $match: {
                    patientId
                },
            }, ]
        })

        patientRecord = first(patientRecord)


        if (!patientRecord) {
            story.validation = `Cannot attach the Patient Story. Patient code "${story.patientId}" not found.`
            res.status(200).send(story)
            return
        }

        
        let existedDoc = find( patientRecord.docs, d => d.type == documentType )

        existedDoc.url = url
        
        await mongodb.updateOne({
            db: config.db,
            collection: `${config.db.name}.${config.db.docCollection}`,
            filter: { id: existedDoc.id },
            data: { url }
        })

        patientRecord.updatedAt = new Date()
        patientRecord.updatedBy = user

        await mongodb.updateOne({
            db: config.db,
            collection: `${config.db.name}.${config.db.patientCollection}`,
            filter: { patientId },
            data: patientRecord
        })


        res.status(200).send({
            patientId: story.patientId,
            documentType,
            validation: true,
            url
        })

    } catch (e) {
        res.status(200).send(e.toString())
    }
}

module.exports = {
    getGrant,
    getConfig,
    getStory,
    releaseStory,
    getCount,
    getList,
    updateStory,
    createStory,
    updateUrl
}