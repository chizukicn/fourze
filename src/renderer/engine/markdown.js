/***
 @author kritsu
 @date 2019/1/18 12:24
 **/
import Engine from "./"
import Markdown from 'markdown-it'
import fs from "fs"

const markdown=new Markdown()

export class JadeEngine extends Engine{
    constructor(){
        super({suffixes: ["md"]})
    }

    render(path) {
        let template=fs.readFileSync(path,{encoding:"utf8"})
        return markdown.render(template)
    }
}
export default new JadeEngine()
