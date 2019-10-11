import {Middleware} from './middleware'

/***
 @author kritsu
 @date 2018/12/5 9:48
 * @return {null}
 **/
export class Filter extends Middleware {
    constructor({chains}) {
        super("filter")
        if (chains.length > 0) {
            chains.sort((a, b) => a.order - b.order)
            let {name, order, handle} = chains.pop()
            this.name = name
            this.order = order
            this.handle = handle
            this.$next = new Filter({chains})
        }
    }

    bind(app) {
        super.bind(app);
    }


    next(context) {
        const {path, request, response} = context

        const {handle=()=>{}, $next} = this

        //判断是否跳转了
        let nexted = false
        //跳转到下一个filter
        const next = () => {
            nexted = true
            if ($next && $next.next) {
                $next.next(context)
            }
            return nexted
        }
        if (this.match(path)) {
            //符合条件,调用filter
            handle(request, response, next)
            return nexted
            //没有跳转,停止递归
        } else {
            //不符合条件,跳过
            return next()
        }
    }

//在尾端添加一个filter
    push(filter) {
        if (this.$next) {
            this.$next.push(filter)
        } else {
            this.$next = new Filter([filter])
        }
    }

//
//插入一个filter
    insert(filter, match) {
        match = match || (({name}) => filter.name === name)
        this.each(f => {
            if (match(f)) {
                let {$next} = f
                f.$next = filter
                filter.push($next)
                return false
            }
            return true
        })
    }

    each(callback) {
        if (this.$next) {
            if (callback(this.$next)) {
                this.$next.each(callback)
            }
        }
    }

    match(requestUrl) {
        let pattern = this.pattern
        if (typeof pattern === "string") {
            pattern = new RegExp(pattern)
        }
        if (typeof pattern === "function") {
            return pattern(requestUrl)
        }
        if (pattern instanceof RegExp) {
            return pattern.test(requestUrl)
        }
    }

}

