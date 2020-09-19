import React, { useState } from 'react'
import ReactDOM from 'react-dom'
import io from 'socket.io-client'
import './index.css'

function Square(props) {
    return (
      <button 
        className={"square" + (props.winning ? " winner" : "")}
        onClick={props.onClick}
      >
        {props.value}
      </button>
    );
}

function GameIdInput(props) {
  const [inputId, setInputId] = useState(props.gameId)
  function handleChange(e) {
    setInputId(e.target.value)
  }
  return (
  <div className="game-settings">
    <input 
      className="game-id-input"
      onChange={handleChange}
      type="text"
      placeholder={props.gameId != null ?  props.gameId : "Game ID"}
    />
    <button
      className="nice-button"
      disabled={inputId == null || inputId == ''}
      onClick={() => props.joinGame(inputId)}
    >
        Join Game
    </button>
    <button
      className="nice-button"
      onClick={props.startGame}
    >
        Start New Game
    </button>
  </div>
  )
}

class Board extends React.Component {

  isWinningSquare(squareNum) {
    const winners = this.props.winningSquares
    if (winners) {
      return (squareNum === winners[0] || squareNum === winners[1] || squareNum === winners[2])
    }
    return false
  }

  renderSquare(i) {
    return (
      <Square
        value={this.props.squares[i]}
        onClick={() => this.props.onClick(i)}
        winning={this.isWinningSquare(i)}
      />
    );
  }

  render() {
    let rows = []
    for (let row=0; row<9; row+=3) {
      rows.push(
        <div key={row} className="board-row">
          {this.renderSquare(row)}
          {this.renderSquare(row+1)}
          {this.renderSquare(row+2)}
        </div>
      )
    }
    
    return (
      <div>
        {rows}
      </div>
    );
  }
}

class Game extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      squares: Array(9).fill(null),
      history: [{}],
      player: 'X',
      currentTurn: 'X',
      gameId: null,
      socket: null,
    }
  }

  componentDidMount() {
    const socket = io("http://localhost:5000/")
    socket.on("error", (error) => {
      console.log('Connection Error: ');
    })
    socket.on("connect", (error) => {
      console.log('WebSocket Client Connected');
      this.setState({socket: socket})
    })
    socket.on("disconnect", (error) => {
      console.log('WebSocket Client Connected');
      this.setState({socket: socket})
    })
    socket.on('start_game', (data) => {
      console.log(data)
      this.setState({
        player: data.player,
        currentTurn: data.turn,
        gameId: data.game_id,
        squares: Array(9).fill(null),
        history: [{}]
      })
    })
    socket.on('join_game_success', (data) => {
      console.log(data)
      this.setState({
        player: data.player,
        currentTurn: data.turn,
        gameId: data.game_id,
        squares: data.board,
        history: data.history,
      })
    })
    socket.on('new_move', (data) => {
      console.log(data)
      this.setState({
        squares: data.board,
        currentTurn: data.turn,
        history: data.history,
      })
    })
  }

  onSocketClose(e) {
    this.setState({
      socket: null
    })
    console.log('WebSocket Closed');
  }

  handleClick = (i) => {
    let history = this.state.history.slice()
    const squares = this.state.squares.slice()
    console.log(squares)
    console.log(this.state.currentTurn)
    console.log(this.state.player)
    console.log(calculateWinner(squares))
    console.log(squares[i])
    if (calculateWinner(squares) || squares[i] || this.state.currentTurn !== this.state.player) {
      return
    }
    history = history.concat([{square: i, player: this.state.player}])
    squares[i] = this.state.player
    this.setState({
      history: history,
      squares: squares
    })
    this.state.socket.emit('new_move', {board: squares, history: history, id: this.state.gameId, player: this.state.player})
  }

  
  startGame = () => {
    console.log(`Start Game`)
    this.state.socket.emit('start_game', {})
  }

  joinGame = (id) => {
    console.log(`Join Game with ${id}`)
    this.state.socket.emit('join_game', {id: id})
  }

  render() {
    const history = this.state.history
    const squares = this.state.squares
    const winner = calculateWinner(squares)
    const moves = history.map((moveInfo, moveNo) => {
      let moveText;
      if (moveNo) {
        const coords = `(${moveInfo.square % 3 + 1},${Math.floor(moveInfo.square / 3) + 1})`
        const player = moveInfo.player
        moveText = `${player} -> ${coords}`
      } else {
        moveText = 'Beginning'
      }
      return (
        <li key={moveNo}>
          <p>{moveText}</p>
        </li>
      )
    })
    let status;
    let winningSquares = null;
    if (winner) {
      status = `${winner[0]} has won!`
      winningSquares = winner[1]
    } else if (history.length >= 10) {
      status = "It's a Draw!"
    } else {
      status = `Next player: ${this.state.currentTurn}`;
    }

    return (
      this.state.socket ? (
        <div className="game">
          <GameIdInput
            gameId={this.state.gameId}
            joinGame={this.joinGame}
            startGame={this.startGame}
          />
            <ActiveGameBoard
            gameId={this.state.gameId}
            status={status}
            squares={squares}
            handleClick={this.handleClick}
            winningSquares={winningSquares}
            moves={moves}
            mySymbol={this.state.player}
            /> 
        </div>
      )
      : (
        <p>
          Can't connect to the server!
        </p>
      )
    );
  }
}

function ActiveGameBoard(props) {
  if (props.gameId == null) {
    return null
  }
  return (
    <div className="active-game">
      <p className="game-status">You are playing as {props.mySymbol}</p>
      <p className="game-status">{props.status}</p>
        <div className="game-board">
          <Board 
            squares={props.squares}
            onClick={(i) => props.handleClick(i)}
            winningSquares={props.winningSquares}/>
        </div>
        <div className="game-info">
          <p>Game History</p>
          <ol>{props.moves}</ol>
        </div>
    </div>
  )
}

function calculateWinner(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return [squares[a], lines[i]];
    }
  }
  return null;
}

// ========================================

ReactDOM.render(
  <Game />,
  document.getElementById('root')
);

