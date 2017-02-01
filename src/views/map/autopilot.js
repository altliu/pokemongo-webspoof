import { capitalize } from 'lodash'

import React, { Component } from 'react'
import { action, observable, computed } from 'mobx'
import { observer } from 'mobx-react'
import places from 'places.js'
import cx from 'classnames'

import Shortcuts from './shortcuts.js'
import autopilot from '../../models/autopilot.js'

// TODO: encapsulate in autopilot model
// NAME, SPEED, ICON
const travelModes = [
  [ 'walk', 9, 'blind' ],
  [ 'cycling', 13, 'bicycle' ], // Credit to https://github.com/DJLectr0
  [ 'subway', 50, 'subway' ],
  [ 'truck', 80, 'truck' ],
  [ 'car', 120, 'car' ],
  [ 'teleport', '~', 'star' ]
]

@observer
class Autopilot extends Component {

  @observable isModalOpen = false
  @observable travelMode = 'cycling'

  @computed get speed() {
    const [ , speed ] = travelModes.find(([ t ]) => t === this.travelMode)
    return speed
  }

  @computed get travelModeName() {
    const [ travelModeName ] = travelModes.find(([ t ]) => t === this.travelMode)
    return travelModeName
  }

  @computed get travelModeIcon() {
    const [ , , travelModeIcon ] = travelModes.find(([ t ]) => t === this.travelMode)
    return travelModeIcon
  }

  componentDidMount() {
    // initialize algolia places input
    this.placesAutocomplete = places({ container: this.placesEl })
    this.placesAutocomplete.on('change', this.handleSuggestionChange)

    window.addEventListener('keyup', ({ keyCode }) => {
      if (keyCode === 27 && this.isModalOpen) {
        this.handleCancelAutopilot()
      }
      // use the space bar to pause/start autopilot
      if (keyCode === 32) {
        if (autopilot.running && !autopilot.paused) {
          autopilot.pause()
        } else if (autopilot.paused) {
          autopilot.resume()
        }
      }
    })
  }

  @action handleDestinationRequest = ({ destination: { latlng: { lat, lng } } }) => {
    autopilot.stop()

    // TODO: currently we assume whatever speed is set
    // var travelmode = travelModes[1];
    // autopilot.speed = travelmode[1] / 3600
    // this.travelMode = travelmode[0]

    autopilot.scheduleTrip(lat, lng)
      .then(() => { 
        // TODO:
        autopilot.steps = JSON.parse(JSON.stringify(autopilot.accurateSteps))
        autopilot.start()
      })
      .catch(() => this.placesAutocomplete.setVal(null))
  }


  @action handleSuggestionChange = ({ suggestion: { latlng: { lat, lng } } }) =>
    autopilot.scheduleTrip(lat, lng)
      .then(() => { if (!this.isModalOpen) this.isModalOpen = true })
      .catch(() => this.placesAutocomplete.setVal(null))


  @action handleStartAutopilot = () => {
    // reset modal state
    this.placesAutocomplete.setVal(null)

    // TODO: Refactor it's ugly
    // update `autopilot` data
    autopilot.steps = JSON.parse(JSON.stringify(autopilot.accurateSteps))
    autopilot.start()

    this.isModalOpen = false
  }

  @action handleCancelAutopilot = () => {
    // reset modal state
    this.placesAutocomplete.setVal(null)
    this.isModalOpen = false
  }

  @action handleSelectTravelMode = (name, speed) => () => {
    autopilot.speed = speed / 3600
    this.travelMode = name
  }

  @action handleChangeSpeed = () => {
    const { destination: { lat, lng } } = autopilot

    autopilot.pause()
    autopilot.scheduleTrip(lat, lng)
      .then(() => { if (!this.isModalOpen) this.isModalOpen = true })
  }

  @action shortcutClickHandler = (event, coords) => {
    autopilot.stop()

    // Set Speed
    var travelmode = event.shiftKey ? travelModes[travelModes.length - 1] : travelModes[1]
    autopilot.speed = travelmode[1] / 3600
    this.travelMode = travelmode[0]
    
    autopilot.scheduleTrip(coords.lat, coords.long)
      .then(() => {
        autopilot.steps = JSON.parse(JSON.stringify(autopilot.accurateSteps))
        autopilot.start()    
      })
  }

  renderTogglePause() {
    if (autopilot.running && !autopilot.paused) {
      return (
        <div
          className='toggle pause btn btn-warning'
          onClick={ autopilot.pause }>
          <i className='fa fa-pause' />
        </div>
      )
    } else {
      return (
        <div
          className='toggle resume btn btn-success'
          onClick={ autopilot.start }>
          <i className='fa fa-play' />
        </div>
      )
    }
  }

  render() {
    return (
      <div className='autopilot'>

        <div className={"search-container " + cx('algolia-places') }>
          <input ref={ (ref) => { this.placesEl = ref } } type='search' placeholder='Destination' />
        </div>

        <div className="status-container">
          <div
            className='autopilot-btn btn btn-danger'
            onClick={ autopilot.stop }
            disabled={ !autopilot.running }>
            Stop autopilot
          </div>
          { this.renderTogglePause() }
          <div
            className='edit btn btn-primary'
            onClick={ this.handleChangeSpeed }>
            <i className={ `fa fa-${this.travelModeIcon}` } />
          </div>
        </div>

        <div className={ cx('autopilot-modal', { open: this.isModalOpen }) }>
          <div className='travel-modes row'>
            { travelModes.map(([ name, speed, icon ]) =>
              <div
                key={ name }
                className={ `col-sm-4 text-center ${name}` }
                onClick={ this.handleSelectTravelMode(name, speed) }>
                <div className={ cx('travel-mode', { selected: name === this.travelMode }) }>
                  <div>
                    <div className={ `fa fa-${icon}` } />
                    <div className='desc'>
                      <strong>{ capitalize(name) } </strong>
                      <span>{ speed } { speed !== '~' && 'km/h' }</span>
                    </div>
                  </div>
                </div>
              </div>
            ) }
          </div>

          <hr />

          { (autopilot.accurateSteps.length !== 0) ?

            <div className='infos row'>
              <div className='col-sm-4 text-center'>
                <strong>Distance: </strong>
                <span className='tag tag-info'>
                  { autopilot.distance.toFixed(2) } km
                </span>
              </div>

              <div className='col-sm-4 text-center'>
                <strong>Speed: </strong>
                <span className='tag tag-info'>
                  { this.speed } km/h
                </span>
              </div>

              <div className='col-sm-4 text-center'>
                <strong>Time: </strong>
                <span className='tag tag-info'>
                  { autopilot.time }
                </span>
              </div>
            </div> :
            <noscript /> }

          <div className='text-center row'>
            <div className='col-sm-2'>
              <button
                type='button'
                className='btn btn-block btn-sm btn-danger'
                onClick={ this.handleCancelAutopilot }>
                Cancel
              </button>
            </div>
            <div className='col-sm-10'>
              <button
                type='button'
                className='btn btn-block btn-sm btn-success'
                disabled={ autopilot.accurateSteps.length === 0 }
                onClick={ this.handleStartAutopilot }>
                { !autopilot.clean ? 'Update' : 'Start' } autopilot!
              </button>
            </div>
          </div>
        </div>
        <Shortcuts onShortcutClick={ this.shortcutClickHandler } />  
      </div>
    )
  }

}

export default Autopilot
