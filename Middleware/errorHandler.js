const errorHandler = (err, req, res, next) => {
    let error = err;
    let field = "Unknown";
    const errCode = err.code;
  
    switch (errCode) {
      case "P2025":
        error = "L'id est introuvable";
        break;
      case "P2023":
        error = "L'id est invalide";
        break;
      case "P2002":
        let a = err.meta.target;
        if (a.includes("code_employe")) {
          error = ` Veuiller choisir une autre code employé`;
          field = 'code_employe'
        }
        break;
    }
  
    res.status(err.statusCode || 500).json({
      error,
      field,
    });
  };
  
  export default errorHandler;
  