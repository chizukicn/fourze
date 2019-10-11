import  axios from 'axios'
export async function hello() {
    return  await axios.get(`https://kritsu.net/api/dressing/profession/list.json`)
        .then(async rs=> await rs.data)
}
