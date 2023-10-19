const { isArray, keys, find, extend } = require("lodash")

const normalizeRules = rules => {
	
	keys(rules).forEach( key => {
	
		let combCount = 0
		
		rules[key] = rules[key].map( r => {
			
			r.score = (r.score) 
			? (isArray(r.score)) ? r.score : [r.score]
			: [0]

			combCount = Math.max(combCount, r.score.length)

			return r	

		})

		rules[key] = rules[key].map( r => {
			
			while( r.score.length < combCount){
					r.score.push(0)
			}
			return r	

		})

		let res = []

		for(let i=0; i < combCount; i++){
			res.push( rules[key].map( r => ({
				title: r.title, 
				score: r.score[i]
			})))
		}	

		rules[key] = res

	})
	

	return rules

}

const calcAnswerScore = ( answer, rules ) => {
	
	let result = {}
		
	let variants = answer.variants
	let aScore = 1
		
	variants = (isArray(variants)) ? variants : [variants]			

	let selectedCount = 0

	variants = variants.map( v => {
	
		let res = {
			title: v
		}
	
		let f = find(rules, r => r.title == v )
	
		if(f){
	
			aScore *= f.score
			res.score = f.score || 0
			selectedCount++
		}

		return res

	})

	return extend({}, answer, { variants }, {score: (selectedCount > 0) ? aScore : 0})

}



module.exports = (answers, scoreRules) => {

		let result = {}

		scoreRules.start = scoreRules.start || 0
		scoreRules.acceptable = scoreRules.acceptable || 0
		scoreRules.max = scoreRules.max || 1
		let score = scoreRules.start

		scoreRules.answers = normalizeRules(scoreRules.answers)

		// console.log("NORMALIZED", scoreRules.answers)


		result.answers = keys(answers).map( key => {
			
			let currentRules = scoreRules.answers[key]
			let answer = answers[key]
			let comb = currentRules.map( c => calcAnswerScore( answer, c ) )
			let maxScore = comb.map(c => c.score).reduce( (c, a) => Math.max(c,a), -Infinity)
			let f = find(comb, c => c.score == maxScore)
			score += f.score
			return f
		
		})	
		

		result.score = score
		// console.log(score, scoreRules.max, (100*score/scoreRules.max).toFixed(0))
		result.percents = Number.parseInt((100*(score-scoreRules.start)/(scoreRules.max-scoreRules.start)).toFixed(0))
		
		result.state = (score >= scoreRules.acceptable) ? "accepted" : "rejected"

		return result
}