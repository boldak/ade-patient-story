const mammoth = require("mammoth") 
const { keys } = require("lodash") 
const LanguageDetect = require('languagedetect')
const langDetector = new LanguageDetect()

DEFAULT_LOCALE = "en"

let validators = {
	
	uk: [
			d => ( d.patientId ) ? true : 'The Patient ID must not be empty.',

			d => ( d.patientId && /[A-Za-z0-9][A-Za-z0-9]+/.test(d.patientId)) ? true : `The Patient ID must be specified in the "${DEFAULT_LOCALE}" locale and must be valid Patient ID.`, 

			d => ( d.gender ) ? true : `The Sex must not be empty.`, 
			
			d => ( d.age && !Number.isNaN(d.age)) ? true : `The Age must not be empty and must be valid number.`, 
			
			d => ( d.city ) ? true : `The City must not be empty.`, 
			
			d => ( d.story ) ? true : `The Story must not be empty.`, 
			
			d => ( d.review ) ? true : `The Review must not be empty.` 
	],

	en: [
			d => ( d.patientId ) ? true : 'The Patient ID must not be empty.',

			d => ( d.patientId && /[A-Za-z0-9][A-Za-z0-9]+/.test(d.patientId) ) ? true : `The Patient ID must be specified in the "${DEFAULT_LOCALE}" locale and must be valid Patient ID.`, 

			d => ( d.gender ) ? true : `The Sex must not be empty.`, 
			
			d => ( d.age && !Number.isNaN(d.age)) ? true : `The Age must not be empty and must be valid number.`, 
			
			d => ( d.city ) ? true : `The City must not be empty.`, 
			
			d => ( d.story ) ? true : `The Story must not be empty.`, 
			
			d => ( d.review ) ? true : `The Review must not be empty.` 
	],

}

const templates = {
	uk: {
	
		patientId:{
			select: /КОД ПАЦІЄНТА([\s\S]*)СТАТЬ/m,
			replace: [/[\_\s]/gm, ""],
		},
		
		gender:{
			select: /СТАТЬ([\s\S]*)ВІК/m,
			replace: [/[\_\s]/gm, ""],
		},

		age:{
			select: /ВІК([\s\S]*)МІСТО/m,
			replace: [/[\_\s]/gm, ""],
			return: text => Number.parseInt(text)
		},

		city:{
			select: /МІСТО([\s\S]*)ІСТОРІЯ ПАЦІЄНТА/m,
			replace: [/[\_\s]/gm, ""],
		},

		story:{
			select: /ІСТОРІЯ ПАЦІЄНТА([\s\S]*)ВРАЖЕННЯ ПАЦІЄНТА ВІД ДОСВІДУ РОБОТИ ЗІ СТЕТОФОНОМ\?/m,
			replace: [/[\n]+/gm, "\n"],
			return: text => {
				let ws = "Додаткова інформація про особу пацієнта. У чому була особливість використання Стетофону для цього пацієнта? Чи допоміг Стетофон обстежити цього пацієнта краще (швидше, зручніше, знайти важливі симптоми, тощо)?"
				let index = text.indexOf(ws)
				return (index > -1) ? text.substring(text.indexOf(ws) + ws.length) : text
			}	
		},

		review:{
			select: /ВРАЖЕННЯ ПАЦІЄНТА ВІД ДОСВІДУ РОБОТИ ЗІ СТЕТОФОНОМ\?([\s\S]*$)/m,
			replace: [/[\n]+/gm, "\n"],
		}
	},

	en: {
	
		patientId:{
			select: /PATIENT CODE([\s\S]*)SEX/m,
			replace: [/[\_\s]/gm, ""],
		},
		
		gender:{
			select: /SEX([\s\S]*)AGE/m,
			replace: [/[\_\s]/gm, ""],
		},

		age:{
			select: /AGE([\s\S]*)CITY/m,
			replace: [/[\_\s]/gm, ""],
			return: text => Number.parseInt(text)
		},

		city:{
			select: /CITY([\s\S]*)PATIENT HISTORY/m,
			replace: [/[\_\s]/gm, ""],
		},

		story:{
			select: /PATIENT HISTORY([\s\S]*)PATIENT'S IMPRESSION OF THE EXPERIENCE WITH STETHOPHONE\?/m,
			replace: [/[\n]+/gm, "\n"],
			return: text => {
				let ws = "Additional information about the patient. What was the peculiarity of using Stethophone for this patient? Did Stethophone help to examine this patient better (faster, more convenient, find important symptoms, etc.)?"
				let index = text.indexOf(ws)
				return (index > -1) ? text.substring(text.indexOf(ws) + ws.length) : text
			}	
		},

		review:{
			select: /PATIENT'S IMPRESSION OF THE EXPERIENCE WITH STETHOPHONE\?([\s\S]*$)/m,
			replace: [/[\n]+/gm, "\n"],
		}
	}		
	
}


const getLocale = text => {
	const locales = {
		english: "en",
		ukrainian: "uk"
	}

	return locales[langDetector.detect(text)[0][0]]

}

const extractTextFromFile = async file => {
	const result = await mammoth.extractRawText({path: file})
	return result.value		
}


const validate = (data, locale) => {

	let res = validators[locale].map( rule => rule(data)).filter( r => r != true)
	return (res.length == 0) ? true : res.join("\n")

}

const getDataFromText = text => {
	let locale = getLocale(text)
	let template = templates[locale]
	let res = {}
	keys(template).forEach( key => {
		let rule = template[key]
		rule.return = rule.return || ( d => d )

		let matches = text.match(rule.select)
		
		if(matches && matches[1]){
			res[key] = rule.return((rule.replace) ? matches[1].replace(rule.replace[0], rule.replace[1]) : matches[1])
		}
	})
	res.locale = locale
	res.validation = validate(res, locale)
	res.updatedAt = new Date()
	res.updatedBy = {
		name: "docx-form"
	}
	return res		
}

const loadForm = async file => {
	try {
		const text = await extractTextFromFile(file)
		return getDataFromText(text)
	} catch(e) {
		return {
			validation: e.toString()
		}
	}	
}

module.exports = {
	getDataFromText,
	extractTextFromFile,
	loadForm
}



// const run = async () => {
// 	try {
		

// 		const form = await loadForm("./src/utils/KOV050.docx")
// 		console.log( form )
	
// 	} catch (e){
// 		console.log(e.toString())
// 	}	
// } 

// run()

