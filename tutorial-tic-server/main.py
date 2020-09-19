import os
from uuid import uuid4

from flask import Flask, render_template_string
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy

project_dir = os.path.dirname(os.path.abspath(__file__))
database_file = "sqlite:///{}".format(os.path.join(project_dir, "games.db"))

app = Flask(__name__)
app.config['SECRET_KEY'] = 'wowowowow'
app.config["SQLALCHEMY_DATABASE_URI"] = database_file
db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins='*')

class Game(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    turn = db.Column(db.String(1), nullable=True)
    board = db.Column(db.String(200), nullable=True)
    history = db.Column(db.String(200), nullable=True)
    started = db.Column(db.Boolean(), nullable=True, default=False)

@app.route('/')
def index():
    return render_template_string('<html><body><h2>This server doesn\'t do frontend, bud</h2></body></html>')

@socketio.on('connect')
def test_connect():
    print("connection")
    emit('my response', {'data': 'Connected'})

@socketio.on('new_move')
def do_turn(json):
    game = Game.query.filter_by(id=json["id"]).first()
    if not game:
        emit('new_move', {'failure': 'invalid game'}, room=json["id"])
        return
    if json["player"] == 'O':
        turn = 'X'
    elif json["player"] == 'X':
        turn = 'O'
    game.turn = turn
    game.board = repr(json['board'])
    game.history = repr(json['history'])
    db.session.commit()
    print(turn)
    # print(f'move for game # {game.id}')
    print(f'new move json: {json}')
    emit('new_move', {'board': json['board'], 'history': json['history'], 'turn': turn}, room=game.id)

@socketio.on('start_game')
def start_game(json):
    print(f'Start game json: {json}')
    game = Game(turn='X', board=repr([None] * 9), history=repr([{}]), started=False)
    db.session.add(game)
    db.session.commit()
    db.session.refresh(game)
    join_room(game.id)
    emit('start_game', {'game_id': game.id, 'player': 'X', 'turn': game.turn})

@socketio.on('join_game')
def join_game(json):
    print(f'Join game json: {json}')
    game = Game.query.filter_by(id=json["id"]).first()
    print(game)
    if game:
        if game.started:
            emit('join_game_failure', {'game_id': json["id"], 'message': 'Game already in progress'})
        else:
            game.started = True
            db.session.commit()
            join_room(game.id)
            emit('join_game_success', 
                {
                 'game_id': game.id,
                 'player': 'O',
                 'turn': game.turn,
                 'board': eval(game.board),
                 'history': eval(game.history)
                }
            )
    else:
        emit('join_game_failure', {'game_id': json["id"], 'message': 'No matching game found'})


if __name__ == '__main__':
    socketio.run(app, debug=True)