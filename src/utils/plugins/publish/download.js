const { extend, last, keys, uniq, flattenDeep, isArray, pairs, values } = require("lodash")
const { writeFile, zip, pathExists, makeDir, rmDir} = require("../../utils/file-system")
const { newWb, addWs, aoa2ws, writeXlsxWb} = require("../../utils/xlsx")
const ObjectsToCsv = require('objects-to-csv');

const YAML = require("js-yaml")
const path = require("path")
const mime = require("mime-types")
const UUID = require("uuid").v4
const uuid = () => last(UUID().split("-"))


const jsonFile = async (filename, data) => {
    writeFile(filename, JSON.stringify(data, null, " "))
}

const yamlFile = async (filename, data) => {
    writeFile(filename, YAML.dump(data))
}

const jsonlFile = async (filename, data) => {
    data = (isArray(data)) ? data : [data]
    data = data.map( d => JSON.stringify(d)).join("\n")
    writeFile(filename, data)
}


const csvFile = async (filename, data) => {
    data = (isArray(data)) ? data : [data]
    const csv = new ObjectsToCsv(data)
    await csv.toDisk(filename, { allColumns: true });
}


const xlsxFile = async (filename, data) => {
    
    data = (isArray(data)) ? data : [data]
    fields = uniq( flattenDeep(data.map( d => keys(d))))
    let res = []
    res.push(fields)
    data.forEach( d => {
        res.push(fields.map( f => (d[f]) ? d[f] : undefined))
    })

    let wb = newWb()
    addWs(wb, aoa2ws(res), "data")
    writeXlsxWb(wb, filename)

}


const dataConverter = {

    "text/csv": csvFile,
    "application/json": jsonFile,
    "application/ld+json": jsonlFile,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": xlsxFile,
    // "application/xml":"",
    // "application/zip":""
    "text/yaml": yamlFile

}





module.exports = async (command, context) => {


    const id = uuid()

    command.filename = command.filename || "data.json"
    const contentType = mime.lookup(command.filename)
    command.note = command.note || { text: "Download zipped ${command.filename}" }
    text = command.note.text

    const convert = dataConverter[contentType]
    if(!convert) throw new Error(`Mime type ${contentType} not supported`)

    const ID = `${context.reportId}-${command.filename}`

    const STATIC_PATH = path.resolve(require("../../../../config/portal").portal.staticPath)

    const DOWNLOAD_PATH = `${STATIC_PATH}/download`

    const TEMP_DIR_PATH = `${STATIC_PATH}/temp/${ID}`
    
    if(!pathExists(TEMP_DIR_PATH)) {
    
        await makeDir(TEMP_DIR_PATH)
    
    }

    if(!pathExists(DOWNLOAD_PATH)) {
    
        await makeDir(DOWNLOAD_PATH)
    
    }

    await convert(`${TEMP_DIR_PATH}/${command.filename}`, command.from)
    await zip(TEMP_DIR_PATH, `${DOWNLOAD_PATH}/${ID}.zip`)
    await rmDir(TEMP_DIR_PATH)

    let widget = {
        id, 
        type:"html-widget", 
        name: id,
        icon:"mdi-language-html5",
        options: { widget:{
            visible: true
          }
        },
        data:{
          source:"embedded",
          embedded:`
          <div 
            class="${(command.decoration) ? command.decoration.class : ''}" 
            style="${(command.decoration) ? command.decoration.style : ''}"
          > 
            <a href="./download/${ID}.zip" target="blank" style="${(command.decoration && command.decoration.underlined) ?  '': 'text-decoration:none;'}">
                <div 
                    class="${(command.note && command.note.decoration) ? command.note.decoration.class : ''}" 
                    style="${(command.note.decoration) ? command.note.decoration.style : ''}"
                >
               
                    ${text}

                </div>    
            </a>

          </div>
          `
        }
       
    }


    return widget
}