'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat,lng]
    this.distance = distance; //in km
    this.duration = duration; //in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    //min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 179);
// const cycle1 = new Cycling([39, -12], 37, 95, 523);
// console.log(run1, cycle1);

/////////////////////////////////////
// Application Architecture
const form = document.querySelector('.form');
const submitButton = document.querySelector('.form__btn');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const sidebar = document.querySelector('.sidebar');
const containerButtons = document.querySelector('.function__buttons');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #curWorkout;
  #markers = [];
  #editMode = false;

  constructor() {
    // get user's position
    this._getPosition();

    // get data from local stage
    this._getLocalStorage();

    // prettier-ignore
    submitButton.addEventListener('click', this._submitWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    sidebar.addEventListener('click', this._clickHandler.bind(this));
    // containerWorkouts.addEventListener('click', this._moveToPopUp.bind(this));
    // containerButtons.addEventListener('click', this._resetViewBtn.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () => {
        alert(`Could not get your position `);
      });
  }
  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];
    // console.log(`https://www.google.com/maps/@${coords}z`);

    // display position
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    // type of map
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // // Marker pop-up
    L.marker(coords).addTo(this.#map).bindPopup('Your location').openPopup();
    // console.log(position);

    // handling clicks on map
    if (!this.#editMode) this.#map.on('click', this._showForm.bind(this));

    // rendering marker after loading the page
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE, work) {
    this.#mapEvent = mapE;
    // Display form
    if ((form.classList.contains = 'hidden')) form.classList.remove('hidden');
    inputDistance.focus();

    // handling elevation and cadence fields change
    this._changeFormFields();

    if (work) {
      // show form for editing
      inputDistance.value = work.distance;
      inputDuration.value = work.duration;
      if (work.type === 'running') {
        inputType.value = 'running';
        inputCadence
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputElevation.closest('.form__row').classList.add('form__row--hidden');
        inputCadence.value = work.cadence;
      } else {
        inputType.value = 'cycling';
        inputCadence.closest('.form__row').classList.add('form__row--hidden');
        inputElevation
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputElevation.value = work.elevationGain;
      }
    }
  }
  // handle type changing
  _toggleElevationField() {
    // closest select closest parent element
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  // handle clicking
  _clickHandler(e) {
    // select edit or delete button
    const btnElement = e.target.closest('.workout__controls i');
    // select cur workout
    const workoutEl = e.target.closest('.workout');
    // select form
    const form = e.target.closest('.form');
    // select reset
    const reset = e.target.closest('.function__buttons button');

    if (form) return;
    // select clicked workout from activity list
    if (workoutEl) {
      const workout = this.#workouts.find(
        work => work.id === workoutEl.dataset.id
      );
      this.#curWorkout = workout;
      if (btnElement) {
        // handle edit button
        if (btnElement.dataset.type === 'edit') {
          this._editWorkout(workout, workoutEl);
        } else {
          // handle delete button
          this._deleteWorkout(workout, workoutEl);
        }
      } else {
        // set the view position
        this.#map.setView(workout.coords, this.#mapZoomLevel, {
          animate: true,
          pan: {
            duration: 1,
          },
        });
      }
      // set local storage to all workouts
      this._setLocalStorage();
    }

    // reset and view all workouts
    if (reset) {
      this._resetViewBtn(e);
      console.log(`reset btn was clicked: ${reset}`);
    }
  }

  // handle submit workout
  _submitWorkout(e) {
    if (this.#editMode) {
      this._changeWorkout(this.#curWorkout, e);
    } else {
      this._newWorkOut(e);
    }
  }
  // edit workout
  _changeWorkout(workout, e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => Number(inp) > 0);
    e.preventDefault();

    // Get data from form
    const type = workout.type;
    const dist = +inputDistance.value;
    const durat = +inputDuration.value;

    // Check if data is valid
    // If workout is running, create running object
    if (type === 'running') {
      const caden = +inputCadence.value;
      if (!validInputs(dist, durat, caden) || !allPositive(dist, durat, caden))
        return alert('Inputs have to be a positive number!');
      // change workout data
      // prettier-ignore
      [workout.distance, workout.duration,workout.cadence] = [dist,durat,caden]
      console.log(workout);
    }

    // If workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevGain = +inputElevation.value;
      if (!validInputs(dist, durat, elevGain) || !allPositive(dist, durat))
        return alert('Inputs have to be a positive number!');
      // change workout data
      // prettier-ignore
      [workout.distance, workout.duration, workout.elevationGain] = [dist,durat,elevGain];
      console.log(workout);
    }
    this._renderWorkout(workout);
    this._hideForm();
    this.#editMode = false;
  }

  // submit the new workout to form
  _newWorkOut(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => Number(inp) > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const dist = +inputDistance.value;
    const durat = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // Check if data is valid
    // If workout is running, create running object
    if (type === 'running') {
      const caden = +inputCadence.value;
      if (!validInputs(dist, durat, caden) || !allPositive(dist, durat, caden))
        return alert('Inputs have to be a positive number!');

      workout = new Running([lat, lng], dist, durat, caden);
    }

    // If workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevGain = +inputElevation.value;
      if (!validInputs(dist, durat, elevGain) || !allPositive(dist, durat))
        return alert('Inputs have to be a positive number!');

      workout = new Cycling([lat, lng], dist, durat, elevGain);
    }

    console.log(workout);
    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // add a new object to workout array
    this.#workouts.push(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // hide the form
    this._hideForm();

    // set local storage to all workouts
    this._setLocalStorage();
  }

  // Functions //////////////

  // adding the marker
  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      // prettier-ignore
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    // save marker in Object
    this.#markers.push(marker);
    workout.markerId = marker._leaflet_id;
  }

  // hide form after entering data
  _hideForm() {
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
    // Hide form + clear input fields
    inputDistance.value = inputCadence.value = inputElevation.value = inputDuration.value =
      '';
  }

  // add list of activities
  _renderWorkout(workout) {
    // we use outerHTML to update UI
    const curWorkEl = document.querySelector(`[data-id="${workout.id}"]`);
    const formList = document.querySelector('.form');
    //prettier-ignore
    const html = `<li class="workout workout--${workout.type}" data-id="${
      workout.id
    }">
    <div class="workout__title--container">
      <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__controls">
        <i class="far fa-edit" data-type ='edit' data-id="${workout.id}"></i>
        <i class="far fa-trash-alt" data-type ='delete'></i>
        </div>
      </div>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${
          workout.type === 'running'
            ? Math.trunc(workout.pace)
            : Math.trunc(workout.speed)
        }</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🦶🏼' : '🗻'
        }</span>
        <span class="workout__value">${
          workout.type === 'running' ? workout.cadence : workout.elevationGain
        }</span>
        <span class="workout__unit">spm</span>
      </div>
      </li>`;

    if (this.#editMode) {
      curWorkEl.outerHTML = html;
    } else {
      formList.insertAdjacentHTML('afterend', html);
    }
  }

  // edit workout
  _editWorkout(work, workoutEl) {
    // let _;
    const editCloseBtns = workoutEl.querySelector('[data-type="edit"]');

    // handle add classes, toggle form and buttons
    this._editWorkHelper(editCloseBtns, work, workoutEl);
  }

  _deleteWorkout(work, workoutEl) {
    // find index of workout
    const workElement = this.#workouts.indexOf(work);
    // // delete workout from the list of workouts
    console.log(`${work} has been deleted`);
    this.#workouts.splice(workElement, 1);
    // // remove UX workout from the list
    workoutEl.remove();
    // find the marker and remove
    const marker = this.#markers.find(
      mark => mark._leaflet_id === work.markerId
    );
    marker.remove();
  }

  _resetViewBtn(e) {
    const curButton = e.target.closest('.function__button');
    if (curButton.dataset.type === 'reset') this.reset();
    if (curButton.dataset.type === 'view') {
      const group = new L.featureGroup();
      this.#workouts.forEach(work => L.marker(work.coords).addTo(group));
      this.#map.fitBounds(group.getBounds());
    }
  }

  _changeFormFields() {
    if (inputType.value === 'running') {
      inputType.value = 'running';
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
    } else {
      inputType.value = 'cycling';
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
    }
  }

  _editWorkHelper(editCloseBtns, work, workoutEl) {
    let _;
    if (editCloseBtns.classList.contains('fa-edit')) {
      this.#editMode = true;
      document.querySelectorAll('.far').forEach(btn => {
        if (btn.classList.contains('fa-times-circle')) {
          btn.classList.remove('fa-times-circle');
          btn.classList.add('fa-edit');
        }
      });
      document.querySelectorAll('.workout').forEach(workout => {
        workout.classList.remove(
          'workout--running--active',
          'workout--cycling--active'
        );
      });
      this.#markers.forEach(mark => {
        mark._popup._container.classList.remove(
          'running-popup--active',
          'cycling-popup--active'
        );
        if (mark._leaflet_id === work.markerId) {
          mark._popup._container.classList.add(`${work.type}-popup--active`);
        }
      });
      workoutEl.classList.add(`workout--${work.type}--active`);
      editCloseBtns.classList.replace('fa-edit', 'fa-times-circle');
      this._showForm(_, work);
    } else {
      this.#editMode = false;
      editCloseBtns.classList.replace('fa-times-circle', 'fa-edit');
      document.querySelectorAll('.workout').forEach(workout => {
        workout.classList.remove(
          'workout--running--active',
          'workout--cycling--active'
        );
      });
      this.#markers.forEach(mark => {
        mark._popup._container.classList.remove(
          'running-popup--active',
          'cycling-popup--active'
        );
      });

      this._hideForm();
    }
  }
  // save list of activities on local storage
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts)); //first is key string, second string is the data saved
  }

  // get workouts from local storage
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts')); //JSON.parse convert string to object !== JSON.stringify - convert everything to string

    if (!data) return;
    this.#workouts = data;
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  // public method
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
