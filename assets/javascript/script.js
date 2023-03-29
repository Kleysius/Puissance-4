function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const playerOne = "Joueur rouge";
const playerTwo = "Joueur jaune";
let gameOver = false;
let turn = 1;
let scoreRed = 0;
let scoreYellow = 0;
let soloGame = false;
let canPlay = true;
let tabl = [
    ["", "", "", "", "", "", ""], // row 0
    ["", "", "", "", "", "", ""], // row 1
    ["", "", "", "", "", "", ""], // row 2
    ["", "", "", "", "", "", ""], // row 3
    ["", "", "", "", "", "", ""], // row 4
    ["", "", "", "", "", "", ""]  // row 5
];

function play(elem) {
    if (gameOver == false && canPlay == true && elem.innerHTML == "") {
        if (turn % 2 != 0) {
            elem.innerHTML = playerOne;
            elem.style.backgroundColor = "red";
            elem.style.fontSize = "0px";
        } else if (soloGame == false && turn % 2 == 0) {
            elem.innerHTML = playerTwo;
            elem.style.backgroundColor = "yellow";
            elem.style.fontSize = "0px";
        }
        gravity(elem)
        updateTabl();
        checkWinner();
        if (soloGame == true && turn % 2 == 0 && gameOver == false) {
            canPlay = false;
            cpuPlay();
        }
    }
}

function gravity(elem) {
    let index = parseInt(elem.id.split('-')[1]) - 1;
    let currentColor = "red";
    let currentPlayer = playerOne;
    const cells = document.querySelectorAll(".cell");
    if (turn % 2 == 0) {
        currentColor = "yellow";
        currentPlayer = playerTwo;
    }
    for (let i = index; i < cells.length; i = i + 7) {
        if (cells[i + 7] && cells[i + 7].innerHTML == "") {
            cells[i].innerHTML = '';
            cells[i].style.backgroundColor = "#aa533faa";
            cells[i].style.fontSize = "0px";
            cells[i + 7].innerHTML = currentPlayer;
            cells[i + 7].style.backgroundColor = currentColor;
            cells[i + 7].style.fontSize = "0px";
        }
    }
}

function updateTabl() {
    let index = 0;
    for (let i = 0; i < tabl.length; i++) {
        for (let j = 0; j < tabl[i].length; j++) {
            tabl[i][j] = document.querySelectorAll(".cell")[index].innerHTML;
            index++;
        }
    }
    turn++;
}

function versusCpu() {
    let randomIndex = random(0, document.querySelectorAll(".cell").length - 1);
    let grid = document.querySelectorAll(".cell");
    while (grid[randomIndex].innerHTML != "") {
        randomIndex = random(0, document.querySelectorAll(".cell").length - 1);
    }
    if (playerOne == "Joueur rouge") {
        grid[randomIndex].innerHTML = "Joueur jaune";
        grid[randomIndex].style.backgroundColor = "yellow";
        grid[randomIndex].style.fontSize = "0px";
    } else if (playerOne == "Joueur jaune") {
        grid[randomIndex].innerHTML = "Joueur rouge";
        grid[randomIndex].style.backgroundColor = "red";
        grid[randomIndex].style.fontSize = "0px";
    }
    gravity(grid[randomIndex]);
    updateTabl();
    checkWinner();
    canPlay = true;
}

function cpuPlay() {
    setTimeout(function () {
        versusCpu();
    }, 500);
}

function playAgain() {
    turn = 1;
    // Réinitialiser le jeu en supprimant le contenu de chaque case de la grille
    let cases = document.querySelectorAll(".cell");
    cases.forEach(function (cells) {
        cells.textContent = "";
        cells.style.backgroundColor = "#aa533faa";
    });
    // Réinitialiser le message de résultat
    let resultElem = document.querySelector(".result");
    resultElem.textContent = "";

    gameOver = false;
}

// Attacher l'événement de clic au bouton "Rejouer"
let retryButton = document.querySelector(".reset-button button");
retryButton.addEventListener("click", playAgain);

function incrementScore(winner) {
    if (winner == "Joueur rouge") {
        scoreRed++;
        document.querySelector(".score-player-red").innerHTML = scoreRed;
    } else if (winner == "Joueur jaune") {
        scoreYellow++;
        document.querySelector(".score-player-yellow").innerHTML = scoreYellow;
    }
}

function chooseMode() {
    soloGame = true;
    playAgain();
}

function checkWinner() {
    let winner = 0;
    // Vérification des lignes
    for (let c = 0; c < tabl.length; c++) {
        for (let r = 0; r < tabl[c].length; r++) {
            if ([r + 3] && tabl[c][r] != "" &&
                tabl[c][r] == tabl[c][r + 1] &&
                tabl[c][r + 1] == tabl[c][r + 2] &&
                tabl[c][r + 2] == tabl[c][r + 3]) {
                document.querySelector(".result").innerHTML = tabl[c][r] + " vainqueur";
                winner = tabl[c][r];
                gameOver = true;
            }
        }
    }
    // Vérification des colonnes
    for (let c = 0; c < tabl.length; c++) {
        for (let r = 0; r < tabl[c].length; r++) {
            if (tabl[c + 3] && tabl[c][r] != "" &&
                tabl[c][r] == tabl[c + 1][r] &&
                tabl[c + 1][r] == tabl[c + 2][r] &&
                tabl[c + 2][r] == tabl[c + 3][r]) {
                document.querySelector(".result").innerHTML = tabl[c][r] + " vainqueur";
                winner = tabl[c][r];
                gameOver = true;
            }
        }
    }
    // Vérification des diagonales gauche droite
    for (let c = 0; c < tabl.length - 3; c++) {
        for (let r = 0; r < tabl[c].length - 3; r++) {
            if (tabl[c][r] != "" &&
                tabl[c][r] == tabl[c + 1][r + 1] &&
                tabl[c + 1][r + 1] == tabl[c + 2][r + 2] &&
                tabl[c + 2][r + 2] == tabl[c + 3][r + 3]
            ) {
                document.querySelector(".result").innerHTML = tabl[c][r] + " vainqueur";
                winner = tabl[c][r];
                gameOver = true;
            }
        }
    }
    // Vérification des diagonales droite gauche
    for (let c = 0; c < tabl.length - 3; c++) {
        for (let r = 3; r < tabl[c].length; r++) {
            if (tabl[c][r] != "" &&
                tabl[c][r] == tabl[c + 1][r - 1] &&
                tabl[c + 1][r - 1] == tabl[c + 2][r - 2] &&
                tabl[c + 2][r - 2] == tabl[c + 3][r - 3]
            ) {
                document.querySelector(".result").innerHTML = tabl[c][r] + " vainqueur";
                winner = tabl[c][r];
                gameOver = true;
            }
        }
    }
    // Vérification si égalité
    if (turn == document.querySelectorAll(".cell").length && gameOver == false) {
        document.querySelector(".result").innerHTML = "Égalité";
        gameOver = true;
    }

    if (gameOver == true) {
        incrementScore(winner);
    }
}