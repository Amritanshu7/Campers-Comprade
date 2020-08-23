const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const methodOverride = require('method-override')
const flash = require('connect-flash')
const User = require('./models/user')
const Campground = require('./models/campground')
const Comment = require('./models/comment')
const campground = require('./models/campground')


const app = express();

const dbURI = 'mongodb+srv://amritanshu:thech@mpi$here@camperscomprade.rdodn.mongodb.net/camperscomprade?retryWrites=true&w=majority';


app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true}));

app.set('view engine', 'ejs');

app.use(express.static(__dirname+'/public'));
app.use(methodOverride("_method"));
app.use(flash());

mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to DB!'))
.catch(error => console.log(error.message));


app.use(require("express-session")({
    secret: "My time is now!",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) =>{
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

app.get('/', (req, res) => {
    res.render("landing");
})



app.get('/campgrounds', (req, res) => {
    Campground.find({},(err , allCampgrounds) => {
        if(err){
            req.flash("error", err.message);
        } else{
            res.render("campgrounds/index",{campgrounds:allCampgrounds, page: 'campgrounds'});
        }
    });
});

app.post('/campgrounds', isLoggedIn, (req, res) => {
    const {name, price, image, description} = req.body;
    const author = {
        id: req.user._id,
        username: req.user.username
    }
    const newCampground = {name: name, price:price, image: image, description: description, author:author}
    Campground.create(newCampground, (err, newlyCreated) => {
        if(err){
            req.flash("error", err.message);
        }
        else{
            res.redirect('/campgrounds');
        }
    });
})

app.get('/campgrounds/new', isLoggedIn, (req, res) => {
    res.render('campgrounds/new');
})

app.get('/campgrounds/:id', (req, res) => {
    Campground.findById(req.params.id).populate("comments").exec((err , foundCampground) => {
        if(err){
            req.flash("error", err.message);
        } else{
            res.render("campgrounds/show",{campground:foundCampground});
        }
    });
});

app.put('/campgrounds/:id',checkCampgroundOwnership, (req, res) => {
    Campground.findByIdAndUpdate(req.params.id,req.body.campground,(err, updatedCampground) =>{
        if(err){
            req.flash("error", err.message);
            res.redirect("/campgrounds");
        } else{
            res.redirect("/campgrounds/" + req.params.id);
        }
    });
});

app.get('/campgrounds/:id/edit',checkCampgroundOwnership ,(req, res) => {
    Campground.findById(req.params.id, (err, foundCampground)=>{
        res.render("campgrounds/edit",{campground: foundCampground});
    })
});

app.delete('/campgrounds/:id',checkCampgroundOwnership, (req, res) => {
    Campground.findByIdAndRemove(req.params.id,(err)=>{
        req.flash("success","Campground Deleted!");
        res.redirect("/campgrounds");
    });

});



// comment routes

app.get("/campgrounds/:id/comments/new", isLoggedIn,(req, res)=> {
    // find campground by id
    Campground.findById(req.params.id,(err, campground)=>{
        if(err){
            req.flash("error", err.message);
            console.log(err);
        } else {
             res.render("comments/new", {campground: campground});
        }
    })
});

app.post("/campgrounds/:id/comments", isLoggedIn,(req, res) => {
   //lookup campground using ID
   Campground.findById(req.params.id, (err, campground) => {
       if(err){
           console.log(err);
           res.redirect("/campgrounds");
       } else {
        Comment.create(req.body.comment,(err, comment) => {
           if(err){
            req.flash("error", err.message);
               console.log(err);
           } else {
               // add username & id to comment
               comment.author.id = req.user._id;
               comment.author.username = req.user.username;
               comment.save();
               campground.comments.push(comment);
               campground.save();
               res.redirect('/campgrounds/' + campground._id);
           }
        });
       }
   });
});

app.get("/campgrounds/:id/comments/:comment_id/edit", checkCommentOwnership,(req, res) => {
    Comment.findById(req.params.comment_id,(err, foundComment)=>{
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        } else{
            res.render("comments/edit",{campground_id: req.params.id,comment:foundComment});
        }
    })
});

app.put("/campgrounds/:id/comments/:comment_id",checkCommentOwnership ,(req, res) => {
    Comment.findByIdAndUpdate(req.params.comment_id,req.body.comment,(err, updatedComment)=>{
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        } else{
            res.redirect("/campgrounds/"+req.params.id);
        }    
    })
});

app.delete("/campgrounds/:id/comments/:comment_id", checkCommentOwnership,(req, res) => {
    Comment.findByIdAndRemove(req.params.comment_id, (err)=>{
        req.flash("success","Comment Deleted!");
        res.redirect("back");
    })
});


// auth routes

app.get("/register", (req, res) =>{
    res.render("register", {page: 'register'});
});


app.post("/register", (req,res) =>{
    User.register(new User({username: req.body.username}),req.body.password, (err ,user)=>{
        if(err){
            console.log(err);
            return res.render("register", {error: err.message});
        }
        passport.authenticate("local")(req, res, () =>{
            req.flash("success","Welcome to Campers Comprade "+err.message);
            res.redirect("/campgrounds");
        })
    })
})

app.get("/login", (req, res) =>{
    res.render("login", {page: 'login'});
});


app.post("/login",passport.authenticate("local",{
    successRedirect: "/campgrounds",
    failureRedirect: "/login"
}));

app.get("/logout", (req, res) =>{
    req.logout();
    req.flash("success","Loged you out!")
    res.redirect("/campgrounds");
});

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash("error","Please Login First!");
    res.redirect("/login");
}

function checkCampgroundOwnership(req,res,next){
    if(req.isAuthenticated()){
        Campground.findById(req.params.id,(err, foundCampground)=>{
            if(err){
                req.flash("error","Campground not Found");
                res.redirect("back");
            } else{
                if(foundCampground.author.id.equals(req.user._id)){
                    next();
                } else{
                    req.flash("error","Permission Denied");
                    res.redirect("back");
                }
            }
        })
    } else{
        req.flash("error","Please Login First!");
        res.redirect("back");
    }
}
function checkCommentOwnership(req,res,next){
    if(req.isAuthenticated()){
        Comment.findById(req.params.comment_id,(err, foundComment)=>{
            if(err){
                req.flash("error","Comment not Found");
                res.redirect("back");
            } else{
                if(foundComment.author.id.equals(req.user._id)){
                    next();
                } else{
                    req.flash("error","Permission Denied!");
                    res.redirect("back");
                }
            }
        })
    } else{
        req.flash("error","Please Login First!");
        res.redirect("back");
    }
}
app.listen(process.env.PORT || 3001, () => console.log(`App listening on port 3001 or ${process.env.PORT}!`))