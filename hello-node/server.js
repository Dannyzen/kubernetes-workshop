const port = 8080
require('http')
  .createServer((req, res) => {
    console.log('url:', req.url)
    res.end('Hi there')
  })
  .listen(port, (error)=>{
    console.log(`server is running on ${port}`)
  })
