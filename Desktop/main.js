const {app, BrowserWindow} = require('electron')

function carregar_janela () {
  const janela = new BrowserWindow({
    width: 800,
    height: 600,
  })
  janela.loadFile(index.html)
}

app.whenReady().then(carregar_janela)