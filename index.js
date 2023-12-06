const router = require('express').Router()

////////////////////////////////////////////////////////////////////////////

const service = require("./src/service")

router.post("/get/", service.getStory)
router.post("/release/", service.releaseStory)
router.post("/update/", service.updateStory)
router.post("/update-url/", service.updateUrl)

router.post("/create/", service.createStory)

router.post("/grant/", service.getGrant)
router.post("/config/", service.getConfig)
router.post("/list/", service.getList)
router.post("/count/", service.getCount)


////////////////////////////////////////////////////////////////////////////


module.exports = router

