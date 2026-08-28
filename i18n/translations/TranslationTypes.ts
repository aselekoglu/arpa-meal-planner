export interface TranslationTypes {
  addMealModal: {
        title: {
            edit: string,
            add: string
        },
        subtitle: string,
        fields: {
            name: {
                label: string,
                placeholder: string,
            },
            tag: {
                label: string,
                placeholder: string,
            },
            servings: {
                label: string,
                placeholder: string,
            },
            url: {
                label: string,
                placeholder: string,
            },
            image: {
                label: string,
                placeholder: string,
            },
            instructions: {
                label: string,
                placeholder: string,
            },
            step: {
                label: string,
                placeholder: string,
            },
            ingredients: {
                label: string,
                placeholder: string,
            },
            ingredient: {
                label: string,
                placeholder: string,
            },
            amount: {
                label: string,
                placeholder: string,
            },
            calories: {
                label: string,
                placeholder: string,
            },
            protein: {
                label: string,
                placeholder: string,
            },
            fat: {
                label: string,
                placeholder: string,
            },
            carbs: {
                label: string,
                placeholder: string,
            },
            imageUrl: {
                placeholder: string,
            },
        },
        links: {
            addStep: string,
            fetchInstructions: string,
            estimate: string,
            addIngredient: string
        },
        texts: {
            noImage: string,
            noInstructions: string
        },
        buttons: {
            upload: string,
            camera: string,
            url: string,
            add: string,
            cancel: string,
            save: string
        },
        errors: {
            camera: string,
            nutrition: string,
            instructions: string,
            meal: string,
            fetchInstructions: string,
        }, 
        nutrition: string,
        responseLangMsg: string,
        meal: string,
        untitledMeal: string,
        successInstruction: string,
  },
  aiJobQueuePanel: {
    jobs: string,
    click: string,
    language: string,
    running: string,
    buttons: {
        clear: string,
    },
    labels: {
        jobs: string,
        queue: string,
        minimize: string,
        result: string,
        dismiss: string,
    }
  },
  aiProviderSelector: {
    fields: {
        AiProvider: {
            label: string,
        },
        model: {
            label: string,
            placeholder: string,
        }
    },
    disable: string,
  },
  app: {
    logo: {
        title: string,
        subtitle: string,
    },
    nav: {
        dashboard: string,
        planner: string,
        grocery: string,
        pantry: string,
        familySync: string,
        chef: {
            title: string,
            subtitle: string,
        }
    },
    mobileNav: {
        home: string,
        planner: string,
        grocery: string,
        pantry: string
        settings: string,
    },
    pageTitle: {
        dashboard: string,
        planner: string,
        grocery: string,
        pantry: string
        preferences: string,
        appName: string,
    },
    placeholders: {
        search: string,
    },
    buttons: {
        theme: {
            light: string,
            dark: string,
        },
        notifications: string,
        nextWeek: string,
        previousWeek: string,
    }
  },
  chatbot: {
    title: string,
    AItext: string,
    message: string,
    fields: {
        q: {
            placeholder: string,
        }
    },
    thinking: string,
  },
  dashboard: {
    pageTitle: string,
    pageSubtitle: string,
    buttons: {
        currentWeek: string,
        importRecipe: string,
        addMeal: string,
    },
    widgets: {
        calories: {
            title: string,
            subtitle: string,
        },
        protein: {
            title: string,
            units: string,
        },
        carbs: {
            title: string,
            units: string,
        },
        fat: {
            title: string,
            units: string,
        }
    },
    weeklyOverview: {
        title: string,
        links: {
            viewCalendar: string,
            recipeDetails: string,
        },
        today: string,
        count: string,
        empty: string,
    },
    grocery: {
        title: string,
        empty: string,
        links: {
            open: string,
        }
    },
    pantry: {
        title: string,
        empty: string,
        alert: {
            title: string,
            amount: string,
        }
    },
    promo: {
        title: string,
        text: string,
        button: string,
    },
    recipes: {
      title: string,
      meal: string,
      meals: string,
      search: {
        placeholder: string,
      },
      all: string,
      empty: {
        title: string,
        subtitle: string,
      }
    }
  },
  familySyncModal: {
    title: string,
    text: string,
    fields: {
        code: {
            label: string,
            placeholder: string
        }
    },
    buttons: {
       cancel: string,
       save: string
    }
  },
  generatePlanModal: {
    title: string,
    subtitle: string 
    text: string,
    AItext: string,
    langText: string,
    dietary: string,
    buttons: {
        cancel: string,
        loading: string,
        generate: string,
    },
    diets: {
        any: string,
        vegan: string,
        paleo: string,
        lowCarb: string,
        vegetarian: string,
        keto: string,
        highProtein: string,
        mediterranean: string,
    }
  },
  grocery: {
    title: string,
    subtitle: string,
    banner: {
        title: string,
        subtitle: string,
        link: string
    },
    title2: string,
    empty: {
        title: string,
        subtitle: string
    },
    buttons: {
        all: string,
        sort: string,
        merge: string,
        group: string,
        export: string
    },
    mergePopup: {
        title: string,
        empty: string,
        fields: {
            addItem: {
                label: string,
                placeholder: string,
            },
            mergeInto: {
                label: string,
                placeholder: string,
            }
        },
        noMatches: string,
        buttons: {
            close: string,
            apply: string,
            merging: string,
        }
    },
    smartGroupPopup: {
        AItext: string,
        langText: string,
        buttons: {
            close: string,
            run: string,
        }
    }
  },
  imageGenerator: {
    title: string,
    subtitle: string,
    text: string,
    fields: {
        quality: {
            label: string,
            options: {
                '1K': string,
                '2K': string,
                '4K': string,
            }
        }
    }, 
    buttons: {
        generate: string,
        loading: string,
        cancel: string,
    },
    googleText: string,
    errors: {
        onlyGoogle: string,
        default: string
    }
  },
  importRecipeModal: {
    title: string,
    subtitle: string,
    text: string,
    fields: {
        search: {
            label: string,
            placeholder: string,
        }
    },
    buttons: {
        cancel: string,
        import: string,
        loading: string,
    },
    errors:  {
        default: string,
        parse: string,
        importFailed: string,
    }
  },
  mealCard: {
    count: string,
    noImage: string,
    menu: {
        edit: string,
        generateImage: string,
        delete: string,
    },
    ingredients: string,
    kcal: string,
    more: string,
  },
  mealDetailsModal: {
    noImageText: string,
    ingredients: string,
    servings: string,
    base: string,
    edit: string,
    viewOriginal: string,
    ingredientsList: {
        title: string,
    },
    instructions: {
        title: string,
        empty: {
            title: string,
            subtitle: string,
        },
        step: string,
        next: string,
        prev: string
    }
  },
  pantry: {
    title: string,
    subtitle: string,
    banner: {
        link: string
    },
    title2: string,
    subtitle2: string,
    empty: {
        title: string,
        subtitle: string
    },
    items: {
        title: string,
        remove: string
    },
    form: {
        title: string,
        subtitle: string,
        fields: {
            name: {
                label: string 
                placeholder: string
            },
            quantity: {
                label: string
            },
            unit: {
                label: string
            }
        },
        button: string
    },
    tip: {
        title: string,
        text: string
    }
  },
  planner: {
    title: string,
    subtitle: string,
    buttons: {
        generatePlan: string,
        remove: string,
        decrease: string,
        increase: string,
        add: string,
    },
    today: string,
    select: string,
    servings: string,
    discovery: {
        title: string,
        subtitle: string,
        search: {
            placeholder: string,
        },
        empty: string,
        all: string,
    },
    errors: {
        move: string,
        update: string,
    }
  },
  preferences: {
    title: string,
    subtitle: string,
    meals: {
        title: string,
        text: string,
        fields: {
            servings: {
                label: string,
            }
        },
        buttons: {
            save: string,
            saved: string,
        }
    },
    calendar: {
        title: string,
        text: string,
        monday: string,
        sunday: string,
    },
    appearance: {
        title: string,
        text: string,
        light: string,
        dark: string,
        system: string,
    },
    ai: {
        title: string,
        fields: {
            providerUi: {
                label: string,
                options: {
                    choose: {
                        title: string,
                        text: string,
                    },
                    one: {
                        title: string,
                        text: string,
                    }
                }
            },
            lang: {
                label: string,
                options: {
                    choose: {
                        title: string,
                        text: string,
                    },
                    one: {
                        title: string,
                        text: string,
                    }
                }
            }
        },
        langHelper: string,
        imageText: string,
    }
  },
  responseLanguageSelector: {
    fields: {
        language: {
            label: string,
        }
    }
  },
}