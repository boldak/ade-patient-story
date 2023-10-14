const { extend, last, find, isArray, shuffle, template, templateSettings } = require("lodash")
const deepExtend = require("deep-extend")

const UUID = require("uuid").v4
const uuid = () => last(UUID().split("-"))



// frame:
            //     type: youtube soundcloud html                
            //     url: 

            //     decoration:
            //         width: a
            //           height: 10
            //         - title: b  
            //         - title: c







module.exports = (command, context) => {

    let id = uuid()

    let widget =  {
            type: "edu-push-button-widget",
            id,
            name: id,
            icon: "mdi-card-outline",
            options: {
                widget: {
                    visible: true
                }

            },

            data: {
                embedded: {
                    "data": {
                        "event": "submit-quiz"
                    },
                    "decoration": extend({
                            "title": "Submit",
                            "outlined": true,
                            "text": false,
                            "color": "primary",
                            "classes": "mx-1 subtitle-2"
                        },command.decoration)
                }
            }
        }


  return {
      context,
      widget:[widget]
    }  
}