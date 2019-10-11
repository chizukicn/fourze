/***
 @author kritsu
 @date 2018/12/6 11:12
 **/
import ejs from 'ejs'
import fs from 'fs'
import Engine from "./"

export class EjsEngine extends Engine {
    constructor() {
        super({suffixes: ["ejs"]})
    }

    render(path) {
        let template=fs.readFileSync(path,{encoding:"utf8"})
        return ejs.render(template)
    }
}
export default new EjsEngine()
