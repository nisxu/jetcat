import { sys } from 'cc';
export class ScoreStore {
    private static _score = 0;
    static resetScore() {
        this._score = 0;
    }
    static addScore(count: number = 1) {
        this._score += count;
    }
    static getScore() {
        return this._score;
    }

    static getBestScore() {
        const score = sys.localStorage.getItem('BestScore');
        if(score){
            return parseInt(score);
        }else{
            return 0;
        }
    }

    static resetBestScore() {
        sys.localStorage.setItem('BestScore', '0');
    }

    static saveScore() {
        const curScore = this.getScore();
        const bestScore = this.getBestScore();
        if(curScore > bestScore){
            sys.localStorage.setItem('BestScore', curScore.toString());
        }
    }
}


