module.exports = function () {
	this.initialize = () => {
		console.log(this)
	}

	this.render = () => {
		return <div> 
			{this.state.count}
			<button onClick={() => {this.setState({ count: this.state.count+= 1})}}>
				add count
			</button>
		</div>
	}
}