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

 const template = {
    
        youtube:
`
<div 
    style="${(command.decoration) ? command.decoration.style || '' : ''}"
    class="${(command.decoration) ? command.decoration.classes || '' : ''}"
>

     <center>
     
        <iframe 
            width="${(command.decoration) ? command.decoration.width || '100%' : '100%'}" 
            height="${(command.decoration) ? command.decoration.height || '300' : '300'}" 
            src="${(command.url)}" 
            frameborder="${(command.decoration) ? command.decoration.style || '0' : '0'}" 
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen
        ></iframe>
     
     </center>
    
 </div>
`,

    soundcloud:
`
<div 
    style="${(command.decoration) ? command.decoration.style || '' : ''}"
    class="${(command.decoration) ? command.decoration.classes || '' : ''}"
>

     <center>
     

        <iframe 
            width="${(command.decoration) ? command.decoration.width || '100%' : '100%'}" 
            height="${(command.decoration) ? command.decoration.height || '300' : '300'}" 
            scrolling="no" 
            frameborder="no" 
            allow="autoplay" 
            src="${(command.url)}"
        ></iframe>     
            
     </center>
    
</div>

`,
    html:
`
<div 
    style="${(command.decoration) ? command.decoration.style || '' : ''}"
    class="${(command.decoration) ? command.decoration.classes || '' : ''}"
>

     <center>
     

        <iframe 
            style="
                width:${(command.decoration) ? command.decoration.width || '100%' : '100%'}; 
                height:${(command.decoration) ? command.decoration.height || '300' : '300'} 
            
            "
            src="${(command.url)}"
        ></iframe>     
            
     </center>
    
</div>

`                
}


    let html = template[command.type] || template.html


    let  widget = {
        type:"html-widget", 
        id,
        name:id,
        icon:"mdi-language-html5",
        options: { widget:{
            visible: true
          }
        },
        data:{
          source:"embedded",
          embedded: html
        }
       
    }


  return {
      context,
      widget:[widget]
    }  
}