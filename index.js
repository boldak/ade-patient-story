const router = require('express').Router()

////////////////////////////////////////////////////////////////////////////

const service = require("./src/service")

router.get("/:id/", service.buildPage)
router.post("/preview/", service.previewPage)
router.post("/open/", service.publishPage)
router.post("/submit/", service.submitTraining)

router.post("/grant/", service.getGrant)
router.post("/training/", service.getTrainingStatus)
router.post("/stat/", service.getStat)

////////////////////////////////////////////////////////////////////////////

const crud = require("./src/crud")

router.post("/crud/list/", crud.getPageList)
router.post("/crud/create/", crud.addPage)
router.post("/crud/read/", crud.getPage)
router.post("/crud/update/", crud.updatePage)
router.post("/crud/delete/", crud.deletePage)


////////////////////////////////////////////////////////////////////////////

const uploader = require("./src/utils/multipart-upload/routes")

router.get("/file/list", uploader.getGdFileList)
router.post("/file/list", uploader.getGdFileList)

////////////////////////////////////////////////////////////////////////////

const trainee = require("./src/trainee")

router.post("/trainee/list", trainee.getTraineeList)
router.post("/trainee/stat", trainee.getTraineeStat)

router.post("/training/status", trainee.getTrainingStatus)
router.post("/training/assign", trainee.assignTraining)
router.post("/training/cancel", trainee.cancelTraining)
router.post("/training/debug", trainee.debugTraining)

////////////////////////////////////////////////////////////////////////////

module.exports = router

