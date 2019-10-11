/***
 @author kritsu
 @date 2018/12/6 10:37
 **/
import Engine from "./"
import jade from 'jade'

export class JadeEngine extends Engine{
    constructor(){
        super({suffixes: ["jade"]})
    }

    render(path) {
        return jade.compileFile(path,{})()
    }
}
export default new JadeEngine()
