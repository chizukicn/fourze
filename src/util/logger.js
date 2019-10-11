/***
 @author kritsu
 @date 2019/1/18 12:05
 **/

function format(type="INFO",obj) {
    return `[INFO - ${new Date().toDateString()}]: ${obj}`
}

class Logger {
    constructor(){
        this.debugStacks=[]
        this.infoStacks=[]
        this.errorStacks=[]
    }

    debug(obj) {
        let message = format("DEBUG", obj)
        this.debugStacks.push(message)
        console.log(message)
    }

    info(obj){
        let message = format("INFO", obj)
        this.infoStacks.push(message)
        console.log(message)
    }

    error(obj){
        let message = format("ERROR", obj)
        this.errorStacks.push(message)
        console.error(message)
    }

}


export default new Logger()
