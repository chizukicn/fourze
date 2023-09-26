export default () => {
  const list = Array.from({ length: 26 }).map((_, i) => String.fromCodePoint(65 + i));
  return () => (
    <html>
      <head>
        <script>
          {
            `
              window.onload = function () {
                console.log("onload script");
              }
            `
          }
        </script>
      </head>
      <body>

        <div class={"w-4 ".concat("h-4").concat(" m-4")}>
          <div>{"Hello,World"}</div>
          {list.map(item => (
            <span class="mr-2">{item}</span>
          ))}
          <div></div>
        </div>
      </body>
      <style>
        {`
          .w-4 {
            width: 1rem;
          }
          .h-4 {
            height: 1rem;
          }
          .m-4 {
            margin: 1rem;
          }
          .mr-2{
            margin-right: 0.5rem;
          }
        `}
      </style>
    </html>
  );
};
