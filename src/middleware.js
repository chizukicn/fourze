/***
 @author kritsu
 @date 2018/12/5 14:33
 **/
let defaultOrder

export class Middleware {
    constructor(name, order = defaultOrder++) {
        this.name = name
        this.order = order
    }

    bind(app) {

    }

    next(context) {

    }

}
